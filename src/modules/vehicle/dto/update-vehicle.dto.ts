import { PartialType } from '@nestjs/mapped-types';
import { CreateVehicleDto } from './create-vehicle.dto';
import { IsOptional, IsBoolean, IsDateString, IsString } from 'class-validator';

export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {
  @IsOptional()
  @IsBoolean()
  inspectionPassed?: boolean;

  @IsOptional()
  @IsDateString()
  inspectionDate?: string;

  @IsOptional()
  @IsString()
  inspectorId?: string;

  @IsOptional()
  @IsBoolean()
  locatorInstalled?: boolean;

  @IsOptional()
  @IsBoolean()
  locatorIntegrated?: boolean;

  @IsOptional()
  @IsString()
  locatorDeviceId?: string;
}
