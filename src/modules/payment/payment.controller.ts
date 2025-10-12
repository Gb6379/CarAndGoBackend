import { Controller, Post, Body, UseGuards, Get, Param, Query, Req } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
  async createPayment(@Body() body: { bookingId: string }, @Req() req: any) {
    return this.paymentService.createPayment(body.bookingId, req.user.id);
  }

  @Post('process')
  @UseGuards(JwtAuthGuard)
  async processPayment(@Body() body: { paymentId: string }) {
    return this.paymentService.processPayment(body.paymentId);
  }

  @Post('pagseguro/notification')
  async handlePagSeguroNotification(@Query() query: any) {
    const { notificationCode, notificationType } = query;
    return this.paymentService.processNotification(notificationCode, notificationType);
  }

  @Get('status/:paymentId')
  @UseGuards(JwtAuthGuard)
  async getPaymentStatus(@Param('paymentId') paymentId: string) {
    return this.paymentService.getPaymentStatus(paymentId);
  }

  @Post('refund')
  @UseGuards(JwtAuthGuard)
  async refundPayment(@Body() body: { paymentId: string; amount?: number }) {
    return this.paymentService.refundPayment(body.paymentId, body.amount);
  }
}
