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
  method?: 'credit_card' | 'pix';
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
  reference?: string;
}

@Injectable()
export class PagSeguroService {
  private readonly legacyBaseUrl: string;
  private readonly checkoutApiBaseUrl: string;
  private readonly email: string;
  private readonly token: string;
  private readonly isSandbox: boolean;

  constructor(private configService: ConfigService) {
    this.email = (this.configService.get<string>('PAGSEGURO_EMAIL') || '').trim();
    const rawToken = (this.configService.get<string>('PAGSEGURO_TOKEN') || '').trim();
    // Aceita token puro ou "Bearer <token>" no env (normaliza para token puro).
    this.token = rawToken.replace(/^Bearer\s+/i, '').trim();
    this.isSandbox = this.configService.get<string>('PAGSEGURO_SANDBOX') === 'true';
    this.legacyBaseUrl = this.isSandbox
      ? 'https://ws.sandbox.pagseguro.uol.com.br'
      : 'https://ws.pagseguro.uol.com.br';
    this.checkoutApiBaseUrl = this.isSandbox
      ? 'https://sandbox.api.pagseguro.com'
      : 'https://api.pagseguro.com';
  }

  private stripTrailingSlashes(url: string): string {
    return (url || '').replace(/\/+$/, '');
  }

  private stripMarkup(input: string): string {
    return (input || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private toCents(amount: number): number {
    return Math.round(Number(amount) * 100);
  }

  private safeDate(dateValue: any): Date {
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) {
      return new Date();
    }
    return parsed;
  }

  /**
   * Sandbox legado (v2 XML) usa query param `token-sandbox`.
   * Produção legado (v2 XML) usa query param `token`.
   */
  private authQueryParamsLegacy(): Record<string, string> {
    if (this.isSandbox) {
      return { email: this.email, 'token-sandbox': this.token };
    }
    return { email: this.email, token: this.token };
  }

  private getCheckoutHeaders() {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
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

  private normalizeCheckoutPhone(phoneRaw?: string) {
    const digits = (phoneRaw || '').replace(/\D/g, '');
    const area = digits.length >= 10 ? digits.slice(0, 2) : '11';
    const rest = digits.length >= 10 ? digits.slice(2) : '999999999';
    let number = rest.slice(0, 9);
    if (number.length < 9) {
      number = number.padEnd(9, '9');
    }
    if (!number.startsWith('9')) {
      number = `9${number.slice(1)}`;
    }
    return {
      country: '+55',
      area,
      number,
    };
  }

  private buildCheckoutCustomer(paymentRequest: PagSeguroPaymentRequest) {
    const name = (paymentRequest.customerName || '').trim().slice(0, 120);
    const email = (paymentRequest.customerEmail || '').trim();
    const taxId = (paymentRequest.customerDocument || '').replace(/\D/g, '');
    if (!name || !email) return undefined;
    if (taxId.length !== 11 && taxId.length !== 14) return undefined;
    return {
      name,
      email,
      tax_id: taxId,
      phone: this.normalizeCheckoutPhone(paymentRequest.customerPhone),
    };
  }

  private extractCheckoutPayLink(checkout: any): string | undefined {
    const links = Array.isArray(checkout?.links) ? checkout.links : [];
    const payLink = links.find(
      (l: any) =>
        String(l?.rel || '').toUpperCase() === 'PAY' &&
        typeof l?.href === 'string',
    );
    return payLink?.href;
  }

  private formatCheckoutApiError(data: any): string | undefined {
    if (Array.isArray(data?.error_messages)) {
      const errors = data.error_messages
        .map((e: any) => {
          const desc = String(e?.description || '').trim();
          const param = String(e?.parameter_name || '').trim();
          if (desc && param) return `${param}: ${desc}`;
          return desc || param;
        })
        .filter(Boolean);
      if (errors.length) return errors.join(' | ');
    }

    if (typeof data === 'string') {
      const msgs = this.extractPagSeguroMessages(data);
      if (msgs.length) return msgs.join(' | ');
      const readable = this.stripMarkup(data);
      if (readable) return readable.slice(0, 280);
      return undefined;
    }

    if (data && typeof data === 'object') {
      const readable = this.stripMarkup(JSON.stringify(data));
      if (readable && readable !== '{}') return readable.slice(0, 280);
    }

    return undefined;
  }

  private parseLegacyTransactionXml(
    xmlResponse: string,
    fallbackTransactionId: string,
  ): PagSeguroTransaction {
    const transactionIdMatch = xmlResponse.match(/<code>(.*?)<\/code>/);
    const statusMatch = xmlResponse.match(/<status>(.*?)<\/status>/);
    const amountMatch = xmlResponse.match(/<grossAmount>(.*?)<\/grossAmount>/);
    const netAmountMatch = xmlResponse.match(/<netAmount>(.*?)<\/netAmount>/);
    const feeAmountMatch = xmlResponse.match(/<feeAmount>(.*?)<\/feeAmount>/);
    const paymentMethodMatch = xmlResponse.match(/<paymentMethod>(.*?)<\/paymentMethod>/);
    const dateMatch = xmlResponse.match(/<date>(.*?)<\/date>/);
    const lastEventDateMatch = xmlResponse.match(/<lastEventDate>(.*?)<\/lastEventDate>/);
    const referenceMatch = xmlResponse.match(/<reference>(.*?)<\/reference>/);

    return {
      transactionId: transactionIdMatch ? transactionIdMatch[1] : fallbackTransactionId,
      status: statusMatch ? statusMatch[1] : 'UNKNOWN',
      amount: amountMatch ? parseFloat(amountMatch[1]) : 0,
      netAmount: netAmountMatch ? parseFloat(netAmountMatch[1]) : 0,
      feeAmount: feeAmountMatch ? parseFloat(feeAmountMatch[1]) : 0,
      paymentMethod: paymentMethodMatch ? paymentMethodMatch[1] : 'UNKNOWN',
      createdAt: this.safeDate(dateMatch ? dateMatch[1] : undefined),
      updatedAt: this.safeDate(lastEventDateMatch ? lastEventDateMatch[1] : undefined),
      reference: referenceMatch ? referenceMatch[1] : undefined,
    };
  }

  private estimateCheckoutAmountFromPayload(payload: any): number {
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const itemsTotalCents = items.reduce((sum: number, item: any) => {
      const unit = Number(item?.unit_amount) || 0;
      const qty = Number(item?.quantity) || 1;
      return sum + unit * qty;
    }, 0);
    const additional = Number(payload?.additional_amount) || 0;
    const discount = Number(payload?.discount_amount) || 0;
    const shipping = Number(payload?.shipping?.amount) || 0;
    const total = itemsTotalCents + additional + shipping - discount;
    return total > 0 ? total / 100 : 0;
  }

  private parseCheckoutWebhookPayload(payload: any): PagSeguroTransaction {
    const charge = Array.isArray(payload?.charges) ? payload.charges[0] : undefined;
    const chargeAmountCents = Number(charge?.amount?.value);
    const amount = Number.isFinite(chargeAmountCents)
      ? chargeAmountCents / 100
      : this.estimateCheckoutAmountFromPayload(payload);
    const rawStatus = String(charge?.status || payload?.status || 'UNKNOWN');
    const paymentMethod = String(
      charge?.payment_method?.type ||
        payload?.payment_methods?.[0]?.type ||
        'CHECKOUT',
    ).toUpperCase();
    const createdAt = this.safeDate(charge?.created_at || payload?.created_at);
    const updatedAt = this.safeDate(
      charge?.paid_at ||
        charge?.updated_at ||
        payload?.updated_at ||
        payload?.created_at,
    );

    return {
      transactionId: String(charge?.id || payload?.id || ''),
      status: rawStatus.toUpperCase(),
      amount,
      netAmount: amount,
      feeAmount: 0,
      paymentMethod,
      createdAt,
      updatedAt,
      reference: payload?.reference_id ? String(payload.reference_id) : undefined,
    };
  }

  async createPayment(
    paymentRequest: PagSeguroPaymentRequest,
  ): Promise<PagSeguroPaymentResponse> {
    try {
      if (!this.token?.trim()) {
        throw new BadRequestException(
          'PagBank: configure PAGSEGURO_TOKEN com o token de integração.',
        );
      }

      const amountNum = Number(paymentRequest.amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        throw new BadRequestException('Valor do pagamento inválido.');
      }
      const amountInCents = this.toCents(amountNum);

      const frontendBase = this.stripTrailingSlashes(
        process.env.FRONTEND_URL || 'http://localhost:3001',
      );
      const redirectURL =
        paymentRequest.redirectURL || `${frontendBase}/payment/callback`;
      const apiBase = this.stripTrailingSlashes(
        process.env.API_URL || process.env.BACKEND_URL || 'http://localhost:3000',
      );
      const notificationURL = `${apiBase}/payments/pagseguro/notification`;

      const method =
        paymentRequest.method === 'pix' ? 'PIX' : 'CREDIT_CARD';
      const payload: any = {
        reference_id: (paymentRequest.reference || `BOOKING_${paymentRequest.bookingId}`).slice(0, 64),
        customer_modifiable: true,
        items: [
          {
            reference_id: String(paymentRequest.bookingId || '').slice(0, 100),
            name: String(paymentRequest.description || 'Reserva CarGo').slice(
              0,
              100,
            ),
            quantity: 1,
            unit_amount: amountInCents,
          },
        ],
        payment_methods: [{ type: method }],
        redirect_url: redirectURL,
        return_url: redirectURL,
        notification_urls: [notificationURL],
        payment_notification_urls: [notificationURL],
      };

      const customer = this.buildCheckoutCustomer(paymentRequest);
      if (customer) {
        payload.customer = customer;
      }

      const response = await axios.post(
        `${this.checkoutApiBaseUrl}/checkouts`,
        payload,
        {
          headers: this.getCheckoutHeaders(),
        },
      );

      const checkout = response.data || {};
      const paymentUrl = this.extractCheckoutPayLink(checkout);
      if (!paymentUrl) {
        throw new BadRequestException(
          'PagBank não retornou link de pagamento (link PAY) na criação do checkout.',
        );
      }

      return {
        transactionId: String(checkout.id || payload.reference_id),
        status: String(checkout.status || 'WAITING'),
        paymentUrl,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      const maybeAxiosError = error as any;
      const status = maybeAxiosError?.response?.status;
      const data = maybeAxiosError?.response?.data;
      console.error('PagBank checkout creation error:', {
        message: maybeAxiosError?.message,
        status,
        data,
      });

      if (status === 401 || status === 403) {
        throw new BadRequestException(
          'PagSeguro/PagBank recusou as credenciais (token). Gere um token em Vendas > Integrações e confira se PAGSEGURO_SANDBOX está correto para o ambiente.',
        );
      }

      const details = this.formatCheckoutApiError(data);
      if (details) {
        throw new BadRequestException(
          `Falha ao criar checkout no PagBank${status ? ` (HTTP ${status})` : ''}: ${details}`,
        );
      }

      throw new BadRequestException('Failed to create payment with PagBank Checkout');
    }
  }

  async getTransactionStatus(transactionId: string): Promise<PagSeguroTransaction> {
    // Fluxo novo: Checkout PagBank (ids geralmente começam com CHEC_)
    if (String(transactionId || '').startsWith('CHEC_')) {
      try {
        const response = await axios.get(
          `${this.checkoutApiBaseUrl}/checkouts/${transactionId}`,
          {
            headers: this.getCheckoutHeaders(),
          },
        );
        const checkout = response.data || {};
        const amount = this.estimateCheckoutAmountFromPayload(checkout);
        const firstMethod = Array.isArray(checkout?.payment_methods)
          ? checkout.payment_methods[0]?.type
          : undefined;

        return {
          transactionId: String(checkout.id || transactionId),
          status: String(checkout.status || 'UNKNOWN').toUpperCase(),
          amount,
          netAmount: amount,
          feeAmount: 0,
          paymentMethod: String(firstMethod || 'CHECKOUT').toUpperCase(),
          createdAt: this.safeDate(checkout.created_at),
          updatedAt: this.safeDate(checkout.updated_at || checkout.created_at),
          reference: checkout.reference_id
            ? String(checkout.reference_id)
            : undefined,
        };
      } catch (error) {
        console.error('PagBank checkout status error:', error);
        throw new BadRequestException(
          'Failed to get transaction status from PagBank Checkout',
        );
      }
    }

    // Fallback legado (v2/v3 XML), para pagamentos antigos já registrados.
    try {
      const response = await axios.get(
        `${this.legacyBaseUrl}/v3/transactions/${transactionId}`,
        {
          params: this.authQueryParamsLegacy(),
        },
      );
      return this.parseLegacyTransactionXml(response.data as string, transactionId);
    } catch (error) {
      console.error('PagSeguro legacy transaction status error:', error);
      throw new BadRequestException(
        'Failed to get transaction status from PagSeguro',
      );
    }
  }

  async processNotification(
    notificationCode?: string,
    _notificationType?: string,
    webhookPayload?: any,
  ): Promise<PagSeguroTransaction> {
    // Fluxo novo (Checkout PagBank): webhook JSON no corpo da requisição.
    if (
      webhookPayload &&
      typeof webhookPayload === 'object' &&
      (webhookPayload.id ||
        webhookPayload.reference_id ||
        webhookPayload.status ||
        webhookPayload.charges)
    ) {
      return this.parseCheckoutWebhookPayload(webhookPayload);
    }

    // Fallback legado (PagSeguro v2/v3): notificationCode via query string.
    if (notificationCode) {
      try {
        const response = await axios.get(
          `${this.legacyBaseUrl}/v3/transactions/notifications/${notificationCode}`,
          {
            params: this.authQueryParamsLegacy(),
          },
        );
        return this.parseLegacyTransactionXml(response.data as string, notificationCode);
      } catch (error) {
        console.error('PagSeguro legacy notification processing error:', error);
        throw new BadRequestException('Failed to process PagSeguro notification');
      }
    }

    throw new BadRequestException(
      'Notificação inválida: sem payload JSON de checkout e sem notificationCode.',
    );
  }

  async refundPayment(transactionId: string, refundAmount?: number): Promise<boolean> {
    // API nova de checkout não usa o mesmo endpoint legado de refund por transactionCode.
    if (String(transactionId || '').startsWith('CHEC_')) {
      console.warn(
        'Refund para checkout CHEC_ via endpoint legado não suportado nesta implementação.',
      );
      return false;
    }

    try {
      const refundData = {
        transactionCode: transactionId,
        refundValue: refundAmount ? refundAmount.toFixed(2) : undefined,
      };

      const response = await axios.post(
        `${this.legacyBaseUrl}/v2/transactions/refunds`,
        refundData,
        {
          params: this.authQueryParamsLegacy(),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const xmlResponse = response.data as string;
      const resultMatch = xmlResponse.match(/<result>(.*?)<\/result>/);
      return resultMatch ? resultMatch[1] === 'OK' : false;
    } catch (error) {
      console.error('PagSeguro refund error:', error);
      return false;
    }
  }

  getPaymentStatusDescription(status: string): string {
    const normalized = String(status || '').trim().toUpperCase();
    const statusMap: { [key: string]: string } = {
      // PagSeguro legado (numérico)
      '1': 'PENDING',
      '2': 'UNDER_REVIEW',
      '3': 'PAID',
      '4': 'AVAILABLE',
      '5': 'IN_DISPUTE',
      '6': 'RETURNED',
      '7': 'CANCELLED',
      // PagBank checkout/order (texto)
      WAITING: 'PENDING',
      IN_ANALYSIS: 'UNDER_REVIEW',
      PAID: 'PAID',
      DECLINED: 'FAILED',
      CANCELED: 'CANCELLED',
      ACTIVE: 'PENDING',
      INACTIVE: 'CANCELLED',
      EXPIRED: 'CANCELLED',
      FAILED: 'FAILED',
      CANCELLED: 'CANCELLED',
    };
    return statusMap[normalized] || normalized || 'UNKNOWN';
  }

  isPaymentSuccessful(status: string): boolean {
    const mapped = this.getPaymentStatusDescription(status);
    return mapped === 'PAID' || mapped === 'AVAILABLE';
  }

  isPaymentPending(status: string): boolean {
    const mapped = this.getPaymentStatusDescription(status);
    return mapped === 'PENDING' || mapped === 'UNDER_REVIEW';
  }

  isPaymentCancelled(status: string): boolean {
    const mapped = this.getPaymentStatusDescription(status);
    return mapped === 'CANCELLED' || mapped === 'FAILED';
  }
}
