import { IsString, IsNumber, IsEnum, IsOptional, IsBoolean, IsArray, IsDateString } from 'class-validator';
import { VehicleType } from '../enums/vehicle-type.enum';
import { FuelType } from '../enums/fuel-type.enum';

export class CreateVehicleDto {
  @IsString()
  make: string;

  @IsString()
  model: string;

  @IsNumber()
  year: number;

  @IsString()
  licensePlate: string;

  @IsEnum(VehicleType)
  type: VehicleType;

  @IsEnum(FuelType)
  fuelType: FuelType;

  @IsNumber()
  engineCapacity: number;

  @IsNumber()
  mileage: number;

  @IsNumber()
  dailyRate: number;

  @IsNumber()
  hourlyRate: number;

  @IsOptional()
  @IsNumber()
  securityDeposit?: number;

  @IsString()
  address: string;

  @IsString()
  city: string;

  @IsString()
  state: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  transmission?: string;

  @IsOptional()
  @IsNumber()
  seats?: number;

  @IsOptional()
  @IsBoolean()
  airConditioning?: boolean;

  @IsOptional()
  @IsBoolean()
  gps?: boolean;

  @IsOptional()
  @IsBoolean()
  bluetooth?: boolean;

  @IsOptional()
  @IsBoolean()
  usbCharger?: boolean;

  @IsString()
  ownerId: string;

  @IsOptional()
  @IsArray()
  photos?: string[];
}
