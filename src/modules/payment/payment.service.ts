import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PagSeguroService } from './services/pagseguro.service';
import { Booking } from '../booking/entities/booking.entity';
import { User } from '../user/entities/user.entity';

@Injectable()
export class PaymentService {
  constructor(
    private configService: ConfigService,
    private pagSeguroService: PagSeguroService,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async createPayment(bookingId: string, userId: string) {
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

    // Create PagSeguro payment
    const paymentRequest = {
      bookingId: booking.id,
      amount: booking.totalAmount,
      customerEmail: user.email,
      customerName: `${user.firstName} ${user.lastName}`,
      customerDocument: user.cpfCnpj,
      customerPhone: user.phone || '11999999999',
      description: `Car rental - ${booking.vehicle.make} ${booking.vehicle.model}`,
      reference: `BOOKING_${booking.id}`,
    };

    const paymentResponse = await this.pagSeguroService.createPayment(paymentRequest);

    // Update booking with payment information
    booking.paymentTransactionId = paymentResponse.transactionId;
    booking.paymentStatus = 'pending' as any;
    await this.bookingRepository.save(booking);

    return {
      paymentId: paymentResponse.transactionId,
      status: paymentResponse.status,
      amount: booking.totalAmount,
      bookingId: booking.id,
      paymentUrl: paymentResponse.paymentUrl,
    };
  }

  async processPayment(paymentId: string) {
    // Get transaction status from PagSeguro
    const transaction = await this.pagSeguroService.getTransactionStatus(paymentId);
    
    // Find booking by transaction ID
    const booking = await this.bookingRepository.findOne({
      where: { paymentTransactionId: paymentId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found for this payment');
    }

    // Update booking payment status
    const paymentStatus = this.pagSeguroService.getPaymentStatusDescription(transaction.status);
    booking.paymentStatus = paymentStatus.toLowerCase() as any;
    booking.paymentDate = transaction.createdAt;
    booking.paymentMethod = transaction.paymentMethod;

    // If payment is successful, confirm the booking
    if (this.pagSeguroService.isPaymentSuccessful(transaction.status)) {
      booking.status = 'confirmed' as any;
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

  async processNotification(notificationCode: string, notificationType: string) {
    // Process PagSeguro notification
    const transaction = await this.pagSeguroService.processNotification(notificationCode, notificationType);
    
    // Update booking status based on notification
    const booking = await this.bookingRepository.findOne({
      where: { paymentTransactionId: transaction.transactionId },
    });

    if (booking) {
      const paymentStatus = this.pagSeguroService.getPaymentStatusDescription(transaction.status);
      booking.paymentStatus = paymentStatus.toLowerCase() as any;
      booking.paymentDate = transaction.updatedAt;

      if (this.pagSeguroService.isPaymentSuccessful(transaction.status)) {
        booking.status = 'confirmed' as any;
      } else if (this.pagSeguroService.isPaymentCancelled(transaction.status)) {
        booking.status = 'cancelled' as any;
      }

      await this.bookingRepository.save(booking);
    }

    return { success: true, transactionId: transaction.transactionId };
  }

  async refundPayment(paymentId: string, amount?: number) {
    // Find booking by transaction ID
    const booking = await this.bookingRepository.findOne({
      where: { paymentTransactionId: paymentId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found for this payment');
    }

    // Process refund through PagSeguro
    const refundAmount = amount || booking.totalAmount;
    const refundSuccess = await this.pagSeguroService.refundPayment(paymentId, refundAmount);

    if (refundSuccess) {
      // Update booking status
      booking.paymentStatus = 'refunded' as any;
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
    const transaction = await this.pagSeguroService.getTransactionStatus(paymentId);
    return {
      paymentId,
      status: this.pagSeguroService.getPaymentStatusDescription(transaction.status),
      amount: transaction.amount,
      netAmount: transaction.netAmount,
      feeAmount: transaction.feeAmount,
      paymentMethod: transaction.paymentMethod,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }
}
