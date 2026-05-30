import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PagSeguroService } from './services/pagseguro.service';
import { MercadoPagoService } from './services/mercadopago.service';
import { Booking } from '../booking/entities/booking.entity';
import { BookingStatus } from '../booking/enums/booking-status.enum';
import { User } from '../user/entities/user.entity';

type PaymentGateway = 'mercadopago' | 'pagbank';

@Injectable()
export class PaymentService {
  constructor(
    private configService: ConfigService,
    private pagSeguroService: PagSeguroService,
    private mercadoPagoService: MercadoPagoService,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async createPayment(
    bookingId: string,
    userId: string,
    method: 'credit_card' | 'pix' = 'credit_card',
  ) {
    // Get booking and user information
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: ['lessee', 'lessor', 'vehicle'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const frontendUrl = (
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001'
    ).replace(/\/+$/, '');
    const paymentRequest = {
      bookingId: booking.id,
      amount: Number(booking.totalAmount),
      customerEmail: user.email,
      customerName: `${user.firstName} ${user.lastName}`,
      customerDocument: user.cpfCnpj || '',
      customerPhone: user.phone || '11999999999',
      description: `Locação - ${booking.vehicle?.make || ''} ${booking.vehicle?.model || ''}`,
      reference: `BOOKING_${booking.id}`,
      method,
      redirectURL: `${frontendUrl}/payment/callback?bookingId=${booking.id}`,
    };

    const gateway = this.getPaymentGateway();
    const paymentResponse =
      gateway === 'mercadopago'
        ? await this.mercadoPagoService.createPayment(paymentRequest)
        : await this.pagSeguroService.createPayment(paymentRequest);

    // Update booking with payment information
    booking.paymentTransactionId = paymentResponse.transactionId;
    booking.paymentStatus = 'PENDING' as any;
    await this.bookingRepository.save(booking);

    return {
      paymentId: paymentResponse.transactionId,
      status: paymentResponse.status,
      amount: Number(booking.totalAmount),
      bookingId: booking.id,
      paymentUrl: paymentResponse.paymentUrl,
    };
  }

  async processPayment(paymentId: string) {
    const transaction = paymentId.startsWith('MP_')
      ? await this.mercadoPagoService.getTransactionStatus(paymentId)
      : await this.pagSeguroService.getTransactionStatus(paymentId);
    
    // Find booking by transaction ID
    const booking = await this.bookingRepository.findOne({
      where: { paymentTransactionId: paymentId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found for this payment');
    }

    // Update booking payment status
    const paymentStatus = this.getGatewayServiceByTransactionId(
      paymentId,
    ).getPaymentStatusDescription(transaction.status);
    booking.paymentStatus =
      this.mapGatewayStatusToLegacyDbValue(paymentStatus) as any;
    booking.paymentDate = transaction.createdAt;
    booking.paymentMethod = transaction.paymentMethod;

    // If payment is successful, confirm the booking
    if (
      this.getGatewayServiceByTransactionId(paymentId).isPaymentSuccessful(
        transaction.status,
      )
    ) {
      booking.status = BookingStatus.CONFIRMED;
    } else if (
      this.getGatewayServiceByTransactionId(paymentId).isPaymentCancelled(
        transaction.status,
      )
    ) {
      booking.status = BookingStatus.CANCELLED;
    }

    await this.bookingRepository.save(booking);

    return {
      paymentId,
      status: paymentStatus,
      amount: transaction.amount,
      processedAt: transaction.updatedAt,
      bookingId: booking.id,
    };
  }

  async processNotification(
    notificationCode?: string,
    notificationType?: string,
    webhookPayload?: any,
  ) {
    // Process PagBank/PagSeguro notification
    const transaction = await this.pagSeguroService.processNotification(
      notificationCode,
      notificationType,
      webhookPayload,
    );
    
    // Update booking status based on notification
    const booking = await this.findBookingForNotification(
      transaction.transactionId,
      transaction.reference,
    );

    if (booking) {
      const paymentStatus =
        this.pagSeguroService.getPaymentStatusDescription(transaction.status);
      booking.paymentStatus =
        this.mapGatewayStatusToLegacyDbValue(paymentStatus) as any;
      booking.paymentDate = transaction.updatedAt;
      booking.paymentMethod = transaction.paymentMethod || booking.paymentMethod;

      if (this.pagSeguroService.isPaymentSuccessful(transaction.status)) {
        booking.status = BookingStatus.CONFIRMED;
      } else if (this.pagSeguroService.isPaymentCancelled(transaction.status)) {
        booking.status = BookingStatus.CANCELLED;
      }

      await this.bookingRepository.save(booking);
    }

    return {
      success: true,
      transactionId: transaction.transactionId,
      reference: transaction.reference,
      bookingFound: !!booking,
    };
  }

  async processMercadoPagoNotification(query: any, body: any) {
    const transaction = await this.mercadoPagoService.processNotification(
      query,
      body,
    );

    const booking = await this.findBookingForNotification(
      transaction.transactionId,
      transaction.reference,
    );

    if (booking) {
      const paymentStatus =
        this.mercadoPagoService.getPaymentStatusDescription(transaction.status);
      booking.paymentStatus =
        this.mapGatewayStatusToLegacyDbValue(paymentStatus) as any;
      booking.paymentDate = transaction.updatedAt;
      booking.paymentMethod = transaction.paymentMethod || booking.paymentMethod;

      if (this.mercadoPagoService.isPaymentSuccessful(transaction.status)) {
        booking.status = BookingStatus.CONFIRMED;
      } else if (this.mercadoPagoService.isPaymentCancelled(transaction.status)) {
        booking.status = BookingStatus.CANCELLED;
      }

      // Quando o MP confirma pagamento, persistimos ID real do pagamento para consultas/estornos.
      if (transaction.transactionId) {
        booking.paymentTransactionId = `MP_PAY_${transaction.transactionId}`;
      }

      await this.bookingRepository.save(booking);
    }

    return {
      success: true,
      transactionId: transaction.transactionId,
      reference: transaction.reference,
      bookingFound: !!booking,
    };
  }

  async refundPayment(paymentId: string, amount?: number) {
    // Find booking by transaction ID
    const booking = await this.bookingRepository.findOne({
      where: { paymentTransactionId: paymentId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found for this payment');
    }

    // Process refund through configured gateway
    const refundAmount = amount || booking.totalAmount;
    const refundSuccess = paymentId.startsWith('MP_')
      ? await this.mercadoPagoService.refundPayment(paymentId, Number(refundAmount))
      : await this.pagSeguroService.refundPayment(paymentId, refundAmount);

    if (refundSuccess) {
      // Update booking status
      booking.paymentStatus = 'REFUNDED' as any;
      booking.refundDate = new Date();
      booking.refundAmount = refundAmount;
      await this.bookingRepository.save(booking);
    }

    return {
      paymentId,
      status: refundSuccess ? 'refunded' : 'refund_failed',
      amount: refundAmount,
      refundedAt: new Date(),
      bookingId: booking.id,
    };
  }

  async getPaymentStatus(paymentId: string) {
    try {
      const gatewayService = this.getGatewayServiceByTransactionId(paymentId);
      const transaction = await gatewayService.getTransactionStatus(paymentId);
      return {
        paymentId,
        status: gatewayService.getPaymentStatusDescription(transaction.status),
        amount: transaction.amount,
        netAmount: transaction.netAmount,
        feeAmount: transaction.feeAmount,
        paymentMethod: transaction.paymentMethod,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
      };
    } catch {
      return { paymentId, status: 'unknown', amount: 0 };
    }
  }

  private getPaymentGateway(): PaymentGateway {
    const raw = String(
      this.configService.get<string>('PAYMENT_GATEWAY') || 'mercadopago',
    )
      .trim()
      .toLowerCase();
    if (raw === 'pagbank' || raw === 'pagseguro') return 'pagbank';
    return 'mercadopago';
  }

  private getGatewayServiceByTransactionId(paymentId: string) {
    if (String(paymentId || '').startsWith('MP_')) {
      return this.mercadoPagoService;
    }
    return this.pagSeguroService;
  }

  /** Verifica se gateway ativo está configurado para uso real */
  private isGatewayConfigured(): boolean {
    const gateway = this.getPaymentGateway();
    if (gateway === 'mercadopago') {
      const token = this.configService.get<string>('MP_ACCESS_TOKEN');
      return !!String(token || '').trim();
    }
    const token = this.configService.get<string>('PAGSEGURO_TOKEN');
    return !!String(token || '').trim();
  }

  /**
   * Process payment by method (credit_card or pix).
   * - Se PagSeguro estiver configurado, retorna paymentUrl para redirecionar (cartão ou PIX no checkout do PagSeguro).
   * - Sem PagSeguro configurado, usa modo simulado (desenvolvimento).
   */
  async payWithMethod(
    bookingId: string,
    userId: string,
    method: 'credit_card' | 'pix',
    cardData?: { number: string; name: string; expiry: string; cvv: string },
  ) {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: ['lessee', 'lessor', 'vehicle'],
    });

    if (!booking) {
      throw new NotFoundException('Reserva não encontrada');
    }

    if (booking.lesseeId !== userId) {
      throw new NotFoundException('Esta reserva não pertence a você');
    }

    const totalAmount = Number(booking.totalAmount);

    const gateway = this.getPaymentGateway();

    // Checkout real via gateway configurado
    if (this.isGatewayConfigured()) {
      try {
        const result = await this.createPayment(bookingId, userId, method);
        return {
          success: true,
          paymentUrl: result.paymentUrl,
          bookingId: result.bookingId,
          amount: result.amount,
          method,
          message:
            method === 'pix'
              ? `Redirecionando para o ${gateway === 'mercadopago' ? 'Mercado Pago' : 'PagBank'} para concluir o pagamento via PIX.`
              : `Redirecionando para o ${gateway === 'mercadopago' ? 'Mercado Pago' : 'PagBank'} para concluir o pagamento.`,
        };
      } catch (error) {
        // Se o checkout não foi criado (erro de gateway/credencial),
        // cancela a reserva para liberar as datas imediatamente.
        booking.status = BookingStatus.CANCELLED;
        booking.paymentStatus = 'FAILED' as any;
        booking.returnNotes =
          'Reserva cancelada automaticamente por falha ao iniciar pagamento.';
        await this.bookingRepository.save(booking);
        throw error;
      }
    }

    // PIX ou cartão sem PagSeguro: modo simulado (desenvolvimento)
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    booking.paymentTransactionId = paymentId;
    booking.paymentStatus = 'PAID' as any;
    booking.paymentMethod = method;
    booking.paymentDate = new Date();
    booking.status = BookingStatus.CONFIRMED;
    await this.bookingRepository.save(booking);

    return {
      success: true,
      paymentId,
      bookingId: booking.id,
      amount: totalAmount,
      method,
      message: method === 'pix' ? 'Pagamento PIX confirmado.' : 'Pagamento com cartão aprovado (simulado).',
    };
  }

  /**
   * Compatibilidade com enum legado no banco:
   * bookings_paymentstatus_enum = ('PENDING','PAID','REFUNDED','FAILED')
   */
  private mapGatewayStatusToLegacyDbValue(status: string):
    | 'PENDING'
    | 'PAID'
    | 'REFUNDED'
    | 'FAILED' {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'PAID' || normalized === 'AVAILABLE') {
      return 'PAID';
    }
    if (normalized === 'UNDER_REVIEW') {
      return 'PENDING';
    }
    if (normalized === 'PENDING') {
      return 'PENDING';
    }
    if (normalized === 'CANCELLED' || normalized === 'DECLINED') {
      return 'FAILED';
    }
    if (normalized === 'FAILED') {
      return 'FAILED';
    }
    return 'PENDING';
  }

  private async findBookingForNotification(
    transactionId: string,
    reference?: string,
  ): Promise<Booking | null> {
    // Novo checkout PagBank envia reference_id; usamos BOOKING_{uuid}.
    if (reference) {
      const candidateId = reference.startsWith('BOOKING_')
        ? reference.slice('BOOKING_'.length)
        : reference;
      if (candidateId) {
        const byId = await this.bookingRepository.findOne({
          where: { id: candidateId },
        });
        if (byId) return byId;
      }
    }

    if (transactionId) {
      const byTransaction = await this.bookingRepository.findOne({
        where: { paymentTransactionId: transactionId },
      });
      if (byTransaction) return byTransaction;
    }

    return null;
  }
}
