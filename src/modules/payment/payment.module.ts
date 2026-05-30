import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PagSeguroService } from './services/pagseguro.service';
import { MercadoPagoService } from './services/mercadopago.service';
import { Booking } from '../booking/entities/booking.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, User])],
  controllers: [PaymentController],
  providers: [PaymentService, PagSeguroService, MercadoPagoService],
  exports: [PaymentService, PagSeguroService, MercadoPagoService],
})
export class PaymentModule {}
