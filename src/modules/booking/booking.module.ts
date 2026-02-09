import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { BookingCalculationService } from './services/booking-calculation.service';
import { RoutePlanningService } from './services/route-planning.service';
import { BookingScheduler } from './booking.scheduler';
import { Booking } from './entities/booking.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Booking])],
  controllers: [BookingController],
  providers: [BookingService, BookingCalculationService, RoutePlanningService, BookingScheduler],
  exports: [BookingService, BookingCalculationService, RoutePlanningService],
})
export class BookingModule {}
