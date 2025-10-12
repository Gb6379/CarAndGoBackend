import { IsString, IsDateString, IsOptional, IsEnum, IsNumber, IsArray } from 'class-validator';
import { InspectionStatus } from '../enums/inspection-status.enum';

export class CreateInspectionDto {
  @IsString()
  vehicleId: string;

  @IsDateString()
  scheduledDate: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsEnum(InspectionStatus)
  status?: InspectionStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
