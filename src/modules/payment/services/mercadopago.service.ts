import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  PagSeguroPaymentRequest,
  PagSeguroPaymentResponse,
  PagSeguroTransaction,
} from './pagseguro.service';

@Injectable()
export class MercadoPagoService {
  private readonly accessToken: string;
  private readonly isSandbox: boolean;

  constructor(private readonly configService: ConfigService) {
    const raw = (this.configService.get<string>('MP_ACCESS_TOKEN') || '').trim();
    this.accessToken = raw.replace(/^Bearer\s+/i, '').trim();
    this.isSandbox = this.configService.get<string>('MP_SANDBOX') === 'true';
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  private stripTrailingSlashes(url: string): string {
    return (url || '').replace(/\/+$/, '');
  }

  private getNotificationUrl(): string {
    const apiBase = this.stripTrailingSlashes(
      this.configService.get<string>('API_URL') ||
        this.configService.get<string>('BACKEND_URL') ||
        'http://localhost:3000',
    );
    return `${apiBase}/payments/mercadopago/notification`;
  }

  private parseDate(value: any): Date {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }

  private isHttpUrl(value?: string): boolean {
    if (!value) return false;
    try {
      const u = new URL(value);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private isPublicCallbackUrl(value?: string): boolean {
    if (!this.isHttpUrl(value)) return false;
    try {
      const u = new URL(value!);
      const host = u.hostname.toLowerCase();
      // Mercado Pago costuma rejeitar back_urls locais para auto_return.
      if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  private extractPaymentIdFromWebhook(query: any, body: any): string | undefined {
    // Formatos possíveis:
    // ?type=payment&data.id=123
    // ?topic=payment&id=123
    // body: { type: 'payment', data: { id: '123' } }
    // body: { action: 'payment.created', data: { id: '123' } }
    const qDataId = query?.['data.id'];
    const qId = query?.id;
    const bDataId = body?.data?.id;
    const bId = body?.id;
    const candidate = qDataId || qId || bDataId || bId;
    return candidate ? String(candidate) : undefined;
  }

  async createPayment(
    paymentRequest: PagSeguroPaymentRequest,
  ): Promise<PagSeguroPaymentResponse> {
    if (!this.accessToken) {
      throw new BadRequestException(
        'Mercado Pago: configure MP_ACCESS_TOKEN.',
      );
    }

    const amount = Number(paymentRequest.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Valor do pagamento inválido.');
    }

    const redirectUrl = paymentRequest.redirectURL;
    if (!redirectUrl) {
      throw new BadRequestException(
        'URL de redirecionamento ausente para Mercado Pago.',
      );
    }

    const body: any = {
      items: [
        {
          id: String(paymentRequest.bookingId),
          title: String(paymentRequest.description || 'Reserva CarAndGo').slice(
            0,
            255,
          ),
          quantity: 1,
          currency_id: 'BRL',
          unit_price: Number(amount.toFixed(2)),
        },
      ],
      external_reference: String(
        paymentRequest.reference || `BOOKING_${paymentRequest.bookingId}`,
      ).slice(0, 256),
      notification_url: this.getNotificationUrl(),
    };

    // Mercado Pago valida back_urls para auto_return; localhost tende a falhar com 400.
    if (this.isPublicCallbackUrl(redirectUrl)) {
      body.back_urls = {
        success: redirectUrl,
        pending: redirectUrl,
        failure: redirectUrl,
      };
      body.auto_return = 'approved';
    }

    // Não força método para não bloquear fluxo do usuário; MP exibe checkout completo.
    // Se quiser forçar PIX/cartão no futuro, podemos ajustar payment_methods.

    try {
      const response = await axios.post(
        'https://api.mercadopago.com/checkout/preferences',
        body,
        { headers: this.getHeaders() },
      );

      const pref = response.data || {};
      const initPoint = this.isSandbox
        ? pref.sandbox_init_point || pref.init_point
        : pref.init_point || pref.sandbox_init_point;

      if (!pref?.id || !initPoint) {
        throw new BadRequestException(
          'Mercado Pago não retornou id/init_point da preferência.',
        );
      }

      return {
        transactionId: `MP_PREF_${pref.id}`,
        status: 'PENDING',
        paymentUrl: initPoint,
      };
    } catch (error) {
      const axiosError = error as any;
      const status = axiosError?.response?.status;
      const data = axiosError?.response?.data;
      const detail =
        data?.message ||
        data?.cause?.[0]?.description ||
        JSON.stringify(data || {}).slice(0, 280);

      if (status === 401 || status === 403) {
        throw new BadRequestException(
          `Mercado Pago recusou credenciais (HTTP ${status}). Verifique MP_ACCESS_TOKEN.`,
        );
      }

      throw new BadRequestException(
        `Falha ao criar preferência no Mercado Pago${
          status ? ` (HTTP ${status})` : ''
        }: ${detail}`,
      );
    }
  }

  async processNotification(query: any, body: any): Promise<PagSeguroTransaction> {
    if (!this.accessToken) {
      throw new BadRequestException(
        'Mercado Pago: configure MP_ACCESS_TOKEN.',
      );
    }

    const type = String(query?.type || query?.topic || body?.type || '').toLowerCase();
    const action = String(body?.action || '').toLowerCase();
    const isPaymentEvent =
      type === 'payment' || action.startsWith('payment.');

    if (!isPaymentEvent) {
      return {
        transactionId: String(body?.id || query?.id || 'mp-webhook'),
        status: 'PENDING',
        amount: 0,
        netAmount: 0,
        feeAmount: 0,
        paymentMethod: 'UNKNOWN',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    const paymentId = this.extractPaymentIdFromWebhook(query, body);
    if (!paymentId) {
      throw new BadRequestException(
        'Webhook Mercado Pago sem payment id (query/body).',
      );
    }

    try {
      const response = await axios.get(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        { headers: this.getHeaders() },
      );
      const payment = response.data || {};
      const amount = Number(payment.transaction_amount || 0);
      const netAmount = Number(
        payment?.transaction_details?.net_received_amount ?? amount,
      );
      const feeAmount = Number(
        payment?.fee_details?.[0]?.amount ?? Math.max(0, amount - netAmount),
      );

      return {
        transactionId: String(payment.id || paymentId),
        status: String(payment.status || 'pending').toUpperCase(),
        amount,
        netAmount,
        feeAmount,
        paymentMethod: String(
          payment.payment_method_id || payment.payment_type_id || 'UNKNOWN',
        ).toUpperCase(),
        createdAt: this.parseDate(payment.date_created),
        updatedAt: this.parseDate(payment.date_approved || payment.date_last_updated),
        reference: payment.external_reference
          ? String(payment.external_reference)
          : undefined,
      };
    } catch (error) {
      const axiosError = error as any;
      const status = axiosError?.response?.status;
      const data = axiosError?.response?.data;
      throw new BadRequestException(
        `Falha ao consultar pagamento Mercado Pago${
          status ? ` (HTTP ${status})` : ''
        }: ${JSON.stringify(data || {}).slice(0, 280)}`,
      );
    }
  }

  async getTransactionStatus(transactionId: string): Promise<PagSeguroTransaction> {
    if (!transactionId?.startsWith('MP_PAY_')) {
      return {
        transactionId,
        status: 'PENDING',
        amount: 0,
        netAmount: 0,
        feeAmount: 0,
        paymentMethod: 'UNKNOWN',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    const paymentId = transactionId.replace('MP_PAY_', '');
    return this.processNotification({ type: 'payment', id: paymentId }, {});
  }

  getPaymentStatusDescription(status: string): string {
    const normalized = String(status || '').toLowerCase();
    const map: Record<string, string> = {
      approved: 'PAID',
      authorized: 'UNDER_REVIEW',
      in_process: 'UNDER_REVIEW',
      pending: 'PENDING',
      rejected: 'FAILED',
      cancelled: 'CANCELLED',
      charged_back: 'CANCELLED',
      refunded: 'CANCELLED',
    };
    return map[normalized] || String(status || 'UNKNOWN').toUpperCase();
  }

  isPaymentSuccessful(status: string): boolean {
    return this.getPaymentStatusDescription(status) === 'PAID';
  }

  isPaymentCancelled(status: string): boolean {
    const mapped = this.getPaymentStatusDescription(status);
    return mapped === 'CANCELLED' || mapped === 'FAILED';
  }

  async refundPayment(transactionId: string, amount?: number): Promise<boolean> {
    if (!this.accessToken || !transactionId?.startsWith('MP_PAY_')) {
      return false;
    }
    const paymentId = transactionId.replace('MP_PAY_', '');
    try {
      const body = amount && amount > 0 ? { amount } : {};
      await axios.post(
        `https://api.mercadopago.com/v1/payments/${paymentId}/refunds`,
        body,
        { headers: this.getHeaders() },
      );
      return true;
    } catch {
      return false;
    }
  }
}

