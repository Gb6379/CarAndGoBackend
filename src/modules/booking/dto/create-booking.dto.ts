import { IsString, IsNumber, IsDateString, IsOptional, IsEnum } from 'class-validator';
import { BookingStatus } from '../enums/booking-status.enum';

export class CreateBookingDto {
  @IsString()
  lesseeId: string;

  @IsString()
  lessorId: string;

  @IsString()
  vehicleId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsNumber()
  dailyRate: number;

  @IsOptional()
  @IsNumber()
  hourlyRate?: number;

  @IsOptional()
  @IsNumber()
  totalAmount?: number; // Calculated by backend if not provided

  @IsOptional()
  @IsNumber()
  securityDeposit?: number;

  @IsOptional()
  @IsString()
  originCity?: string;

  @IsOptional()
  @IsString()
  destinationCity?: string;

  @IsOptional()
  @IsNumber()
  originLatitude?: number;

  @IsOptional()
  @IsNumber()
  originLongitude?: number;

  @IsOptional()
  @IsNumber()
  destinationLatitude?: number;

  @IsOptional()
  @IsNumber()
  destinationLongitude?: number;

  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;
}
