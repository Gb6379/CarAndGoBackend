import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface PagSeguroPaymentRequest {
  bookingId: string;
  amount: number;
  customerEmail: string;
  customerName: string;
  customerDocument: string;
  customerPhone: string;
  description: string;
  reference: string;
  /** URL para onde o usuário será redirecionado após o pagamento (ex: frontend/payment/callback?bookingId=xxx) */
  redirectURL?: string;
}

export interface PagSeguroPaymentResponse {
  transactionId: string;
  status: string;
  paymentUrl: string;
  barcode?: string;
  qrCode?: string;
}

export interface PagSeguroTransaction {
  transactionId: string;
  status: string;
  amount: number;
  netAmount: number;
  feeAmount: number;
  paymentMethod: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PagSeguroService {
  private readonly baseUrl: string;
  private readonly email: string;
  private readonly token: string;
  private readonly isSandbox: boolean;

  constructor(private configService: ConfigService) {
    this.email = this.configService.get<string>('PAGSEGURO_EMAIL');
    this.token = this.configService.get<string>('PAGSEGURO_TOKEN');
    this.isSandbox = this.configService.get<string>('PAGSEGURO_SANDBOX') === 'true';
    this.baseUrl = this.isSandbox 
      ? 'https://ws.sandbox.pagseguro.uol.com.br'
      : 'https://ws.pagseguro.uol.com.br';
  }

  private stripTrailingSlashes(url: string): string {
    return (url || '').replace(/\/+$/, '');
  }

  /** PagSeguro v2 devolve erros em XML com tags <message>. */
  /**
   * Sandbox: query string deve usar `token-sandbox` (doc PagBank).
   * Produção: `token`.
   * @see https://developer.pagbank.com.br/v1/reference/checkout-pagseguro-criacao-checkout-pagseguro
   */
  private authQueryParams(): Record<string, string> {
    if (this.isSandbox) {
      return { email: this.email, 'token-sandbox': this.token };
    }
    return { email: this.email, token: this.token };
  }

  private extractPagSeguroMessages(xml: string): string[] {
    if (!xml || typeof xml !== 'string') return [];
    const messages: string[] = [];
    const re = /<message>([\s\S]*?)<\/message>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) {
      const text = m[1].trim();
      if (text) messages.push(text);
    }
    return messages;
  }

  /** Remove tags XML/HTML para mostrar um trecho legível de erro. */
  private stripMarkup(input: string): string {
    return (input || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async createPayment(paymentRequest: PagSeguroPaymentRequest): Promise<PagSeguroPaymentResponse> {
    try {
      if (!this.email?.trim() || !this.token?.trim()) {
        throw new BadRequestException(
          'PagSeguro: configure PAGSEGURO_EMAIL e PAGSEGURO_TOKEN.',
        );
      }

      // TypeORM devolve `decimal` como string em runtime; PagSeguro precisa de "12.34".
      const amountNum = Number(paymentRequest.amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        throw new BadRequestException('Valor do pagamento inválido.');
      }

      const frontendBase = this.stripTrailingSlashes(
        process.env.FRONTEND_URL || 'http://localhost:3001',
      );
      const redirectURL =
        paymentRequest.redirectURL || `${frontendBase}/payment/callback`;
      const customerCpf = (paymentRequest.customerDocument || '').replace(/\D/g, '');
      // PagSeguro v2 costuma validar CPF do comprador; se vier vazio, acaba em 400 genérico.
      if (!customerCpf) {
        throw new BadRequestException('CPF do usuário é obrigatório para criar pagamento no PagSeguro.');
      }
      if (customerCpf.length !== 11) {
        throw new BadRequestException('CPF inválido. Informe um CPF com 11 dígitos.');
      }

      const phoneDigits = (paymentRequest.customerPhone || '').replace(/\D/g, '');
      // Esperado: DDD + número. Se não vier, usamos fallback para não quebrar.
      const areaCode = phoneDigits.length >= 10 ? phoneDigits.slice(0, 2) : '11';
      const phoneNumber = phoneDigits.length >= 10 ? phoneDigits.slice(2, 11) : '999999999';

      const notificationURLBase = this.stripTrailingSlashes(
        process.env.API_URL || process.env.BACKEND_URL || 'http://localhost:3000',
      );
      const fullNotificationUrl = `${notificationURLBase}/payments/pagseguro/notification`;

      if (
        !this.isSandbox &&
        /localhost|127\.0\.0\.1/i.test(fullNotificationUrl)
      ) {
        throw new BadRequestException(
          'PagSeguro em produção não aceita URL de notificação em localhost. Para testar no PC: defina PAGSEGURO_SANDBOX=true e use e-mail + token de sandbox, ou exponha o backend com um túnel (ex.: ngrok) e coloque essa URL pública em API_URL.',
        );
      }
      if (!this.isSandbox && /localhost|127\.0\.0\.1/i.test(redirectURL)) {
        throw new BadRequestException(
          'PagSeguro em produção costuma exigir URL de retorno (redirect) acessível na internet, não localhost. Use sandbox ou um domínio/túnel HTTPS no FRONTEND_URL.',
        );
      }

      // Sandbox: e-mail do comprador deve ser @sandbox.pagseguro.com.br (doc PagBank).
      let senderEmail = (paymentRequest.customerEmail || '').trim();
      if (this.isSandbox) {
        if (!senderEmail.toLowerCase().endsWith('@sandbox.pagseguro.com.br')) {
          const localPart =
            (senderEmail.split('@')[0] || 'comprador')
              .replace(/[^a-zA-Z0-9._-]/g, '')
              .slice(0, 48) || 'comprador';
          senderEmail = `${localPart}@sandbox.pagseguro.com.br`;
        }
      }

      const paymentData: Record<string, string> = {
        currency: 'BRL',
        // itemId alfanumérico (evita rejeição por hífens do UUID)
        itemId1: paymentRequest.bookingId.replace(/-/g, ''),
        itemDescription1: paymentRequest.description.slice(0, 100),
        itemAmount1: amountNum.toFixed(2),
        itemQuantity1: '1',
        // Peso mínimo (gramas); exigido em vários exemplos da API v2
        itemWeight1: '1',
        reference: paymentRequest.reference.slice(0, 200),
        senderName: paymentRequest.customerName.slice(0, 50),
        senderEmail,
        senderCPF: customerCpf,
        senderAreaCode: areaCode,
        senderPhone: phoneNumber,
        receiverEmail: this.email,
        shippingAddressRequired: 'false',
        shippingType: '3', // Not specified
        shippingCost: '0.00',
        extraAmount: '0.00',
        redirectURL,
        notificationURL: fullNotificationUrl,
        maxUses: '1',
        maxAge: '3600',
      };

      // PagSeguro v2 espera application/x-www-form-urlencoded (não JSON).
      const form = new URLSearchParams();
      Object.entries(paymentData).forEach(([k, v]) => form.append(k, v));

      const response = await axios.post(
        `${this.baseUrl}/v2/checkout`,
        form,
        {
          params: this.authQueryParams(),
          headers: {
            'Content-Type':
              'application/x-www-form-urlencoded; charset=ISO-8859-1',
          },
        }
      );

      // Parse XML response (PagSeguro returns XML)
      const xmlResponse = response.data as string;
      const codeMatch = xmlResponse.match(/<code>(.*?)<\/code>/);
      const errorMessages = this.extractPagSeguroMessages(xmlResponse);

      if (!codeMatch) {
        if (errorMessages.length) {
          throw new BadRequestException(errorMessages.join(' | '));
        }
        throw new BadRequestException('Failed to create PagSeguro payment');
      }

      const transactionCode = codeMatch[1];
      const paymentUrl = `${this.isSandbox ? 'https://sandbox.pagseguro.uol.com.br' : 'https://pagseguro.uol.com.br'}/v2/checkout/payment.html?code=${transactionCode}`;

      return {
        transactionId: transactionCode,
        status: 'PENDING',
        paymentUrl,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      const maybeAxiosError = error as any;
      const status = maybeAxiosError?.response?.status;
      const data = maybeAxiosError?.response?.data;
      console.error('PagSeguro payment creation error:', {
        message: maybeAxiosError?.message,
        status,
        data,
      });
      if (typeof data === 'string') {
        const msgs = this.extractPagSeguroMessages(data);
        if (msgs.length) {
          throw new BadRequestException(msgs.join(' | '));
        }
      }
      if (status === 401 || status === 403) {
        throw new BadRequestException(
          'PagSeguro recusou as credenciais (e-mail/token). Em sandbox use o e-mail e o token do vendedor em https://sandbox.pagseguro.uol.com.br/ → Perfis de Integração → Vendedor (não use o token só do portaldev se a API v2 rejeitar).',
        );
      }
      if (status === 500 || status === 502 || status === 503) {
        throw new BadRequestException(
          'PagSeguro retornou erro no servidor (500). Confira: PAGSEGURO_SANDBOX=true, e-mail e token do perfil Vendedor (sandbox), e se o erro persistia antes: o sandbox exige o parâmetro de URL token-sandbox (já corrigido no backend).',
        );
      }

      // Fallback de diagnóstico: expõe status e parte do payload de erro do PagSeguro.
      if (status) {
        const raw = typeof data === 'string' ? data : JSON.stringify(data || {});
        const readable = this.stripMarkup(raw).slice(0, 280);
        throw new BadRequestException(
          `PagSeguro checkout falhou (HTTP ${status}). ${readable || 'Sem detalhes no corpo da resposta.'}`,
        );
      }

      throw new BadRequestException('Failed to create payment with PagSeguro');
    }
  }

  async getTransactionStatus(transactionId: string): Promise<PagSeguroTransaction> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/v3/transactions/${transactionId}`,
        {
          params: this.authQueryParams(),
        }
      );

      const xmlResponse = response.data;
      
      // Parse XML response
      const statusMatch = xmlResponse.match(/<status>(.*?)<\/status>/);
      const amountMatch = xmlResponse.match(/<grossAmount>(.*?)<\/grossAmount>/);
      const netAmountMatch = xmlResponse.match(/<netAmount>(.*?)<\/netAmount>/);
      const feeAmountMatch = xmlResponse.match(/<feeAmount>(.*?)<\/feeAmount>/);
      const paymentMethodMatch = xmlResponse.match(/<paymentMethod>(.*?)<\/paymentMethod>/);
      const dateMatch = xmlResponse.match(/<date>(.*?)<\/date>/);
      const lastEventDateMatch = xmlResponse.match(/<lastEventDate>(.*?)<\/lastEventDate>/);

      return {
        transactionId,
        status: statusMatch ? statusMatch[1] : 'UNKNOWN',
        amount: amountMatch ? parseFloat(amountMatch[1]) : 0,
        netAmount: netAmountMatch ? parseFloat(netAmountMatch[1]) : 0,
        feeAmount: feeAmountMatch ? parseFloat(feeAmountMatch[1]) : 0,
        paymentMethod: paymentMethodMatch ? paymentMethodMatch[1] : 'UNKNOWN',
        createdAt: dateMatch ? new Date(dateMatch[1]) : new Date(),
        updatedAt: lastEventDateMatch ? new Date(lastEventDateMatch[1]) : new Date(),
      };
    } catch (error) {
      console.error('PagSeguro transaction status error:', error);
      throw new BadRequestException('Failed to get transaction status from PagSeguro');
    }
  }

  async processNotification(notificationCode: string, notificationType: string): Promise<PagSeguroTransaction> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/v3/transactions/notifications/${notificationCode}`,
        {
          params: this.authQueryParams(),
        }
      );

      const xmlResponse = response.data;
      
      // Parse XML response
      const transactionIdMatch = xmlResponse.match(/<code>(.*?)<\/code>/);
      const statusMatch = xmlResponse.match(/<status>(.*?)<\/status>/);
      const amountMatch = xmlResponse.match(/<grossAmount>(.*?)<\/grossAmount>/);
      const netAmountMatch = xmlResponse.match(/<netAmount>(.*?)<\/netAmount>/);
      const feeAmountMatch = xmlResponse.match(/<feeAmount>(.*?)<\/feeAmount>/);
      const paymentMethodMatch = xmlResponse.match(/<paymentMethod>(.*?)<\/paymentMethod>/);
      const dateMatch = xmlResponse.match(/<date>(.*?)<\/date>/);
      const lastEventDateMatch = xmlResponse.match(/<lastEventDate>(.*?)<\/lastEventDate>/);

      const transactionId = transactionIdMatch ? transactionIdMatch[1] : notificationCode;

      return {
        transactionId,
        status: statusMatch ? statusMatch[1] : 'UNKNOWN',
        amount: amountMatch ? parseFloat(amountMatch[1]) : 0,
        netAmount: netAmountMatch ? parseFloat(netAmountMatch[1]) : 0,
        feeAmount: feeAmountMatch ? parseFloat(feeAmountMatch[1]) : 0,
        paymentMethod: paymentMethodMatch ? paymentMethodMatch[1] : 'UNKNOWN',
        createdAt: dateMatch ? new Date(dateMatch[1]) : new Date(),
        updatedAt: lastEventDateMatch ? new Date(lastEventDateMatch[1]) : new Date(),
      };
    } catch (error) {
      console.error('PagSeguro notification processing error:', error);
      throw new BadRequestException('Failed to process PagSeguro notification');
    }
  }

  async refundPayment(transactionId: string, refundAmount?: number): Promise<boolean> {
    try {
      const refundData = {
        transactionCode: transactionId,
        refundValue: refundAmount ? refundAmount.toFixed(2) : undefined,
      };

      const response = await axios.post(
        `${this.baseUrl}/v2/transactions/refunds`,
        refundData,
        {
          params: this.authQueryParams(),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      // Check if refund was successful
      const xmlResponse = response.data;
      const resultMatch = xmlResponse.match(/<result>(.*?)<\/result>/);
      
      return resultMatch ? resultMatch[1] === 'OK' : false;
    } catch (error) {
      console.error('PagSeguro refund error:', error);
      return false;
    }
  }

  private async getSessionId(): Promise<string> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/v2/sessions`,
        null,
        {
          params: this.authQueryParams(),
        }
      );

      const xmlResponse = response.data;
      const sessionIdMatch = xmlResponse.match(/<id>(.*?)<\/id>/);
      
      if (!sessionIdMatch) {
        throw new BadRequestException('Failed to get PagSeguro session ID');
      }

      return sessionIdMatch[1];
    } catch (error) {
      console.error('PagSeguro session ID error:', error);
      throw new BadRequestException('Failed to get session ID from PagSeguro');
    }
  }

  getPaymentStatusDescription(status: string): string {
    const statusMap: { [key: string]: string } = {
      '1': 'PENDING', // Aguardando pagamento
      '2': 'UNDER_REVIEW', // Em análise
      '3': 'PAID', // Paga
      '4': 'AVAILABLE', // Disponível
      '5': 'IN_DISPUTE', // Em disputa
      '6': 'RETURNED', // Devolvida
      '7': 'CANCELLED', // Cancelada
    };

    return statusMap[status] || 'UNKNOWN';
  }

  isPaymentSuccessful(status: string): boolean {
    return status === '3' || status === '4'; // PAID or AVAILABLE
  }

  isPaymentPending(status: string): boolean {
    return status === '1' || status === '2'; // PENDING or UNDER_REVIEW
  }

  isPaymentCancelled(status: string): boolean {
    return status === '7'; // CANCELLED
  }
}
