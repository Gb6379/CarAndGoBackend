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

  async createPayment(paymentRequest: PagSeguroPaymentRequest): Promise<PagSeguroPaymentResponse> {
    try {
      const sessionId = await this.getSessionId();
      
      const paymentData = {
        currency: 'BRL',
        itemId1: paymentRequest.bookingId,
        itemDescription1: paymentRequest.description,
        itemAmount1: paymentRequest.amount.toFixed(2),
        itemQuantity1: '1',
        reference: paymentRequest.reference,
        senderName: paymentRequest.customerName,
        senderEmail: paymentRequest.customerEmail,
        senderCPF: paymentRequest.customerDocument.replace(/\D/g, ''),
        senderPhone: paymentRequest.customerPhone.replace(/\D/g, ''),
        shippingType: '3', // Not specified
        shippingCost: '0.00',
        extraAmount: '0.00',
        redirectURL: `${process.env.FRONTEND_URL}/payment/callback`,
        notificationURL: `${process.env.API_URL}/payments/pagseguro/notification`,
        maxUses: '1',
        maxAge: '3600',
      };

      const response = await axios.post(
        `${this.baseUrl}/v2/checkout`,
        paymentData,
        {
          params: {
            email: this.email,
            token: this.token,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      // Parse XML response (PagSeguro returns XML)
      const xmlResponse = response.data;
      const codeMatch = xmlResponse.match(/<code>(.*?)<\/code>/);
      const dateMatch = xmlResponse.match(/<date>(.*?)<\/date>/);

      if (!codeMatch) {
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
      console.error('PagSeguro payment creation error:', error);
      throw new BadRequestException('Failed to create payment with PagSeguro');
    }
  }

  async getTransactionStatus(transactionId: string): Promise<PagSeguroTransaction> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/v3/transactions/${transactionId}`,
        {
          params: {
            email: this.email,
            token: this.token,
          },
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
          params: {
            email: this.email,
            token: this.token,
          },
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
          params: {
            email: this.email,
            token: this.token,
          },
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
          params: {
            email: this.email,
            token: this.token,
          },
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
