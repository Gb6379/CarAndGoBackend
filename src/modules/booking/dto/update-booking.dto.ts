import { PartialType } from '@nestjs/mapped-types';
import { CreateBookingDto } from './create-booking.dto';
import { IsOptional, IsBoolean, IsDateString, IsString, IsNumber, IsEnum } from 'class-validator';
import { BookingStatus } from '../enums/booking-status.enum';
import { PaymentStatus } from '../enums/payment-status.enum';

export class UpdateBookingDto extends PartialType(CreateBookingDto) {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsDateString()
  actualStartDate?: string;

  @IsOptional()
  @IsDateString()
  actualEndDate?: string;

  @IsOptional()
  @IsNumber()
  actualDistance?: number;

  @IsOptional()
  @IsNumber()
  startMileage?: number;

  @IsOptional()
  @IsNumber()
  endMileage?: number;

  @IsOptional()
  @IsBoolean()
  checkoutCompleted?: boolean;

  @IsOptional()
  @IsBoolean()
  returnCompleted?: boolean;

  @IsOptional()
  @IsBoolean()
  earlyReturn?: boolean;

  @IsOptional()
  @IsNumber()
  lesseeRating?: number;

  @IsOptional()
  @IsNumber()
  lessorRating?: number;

  @IsOptional()
  @IsString()
  lesseeReview?: string;

  @IsOptional()
  @IsString()
  lessorReview?: string;
}
