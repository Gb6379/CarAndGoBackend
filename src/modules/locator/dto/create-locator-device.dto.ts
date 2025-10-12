import { IsString, IsOptional, IsEnum, IsBoolean, IsNumber } from 'class-validator';
import { DeviceStatus } from '../enums/device-status.enum';

export class CreateLocatorDeviceDto {
  @IsString()
  deviceId: string;

  @IsString()
  imei: string;

  @IsOptional()
  @IsEnum(DeviceStatus)
  status?: DeviceStatus;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  firmwareVersion?: string;

  @IsOptional()
  @IsNumber()
  batteryLevel?: number;

  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;

  @IsOptional()
  @IsString()
  simCardNumber?: string;

  @IsOptional()
  @IsString()
  simCardProvider?: string;

  @IsOptional()
  @IsNumber()
  trackingInterval?: number;

  @IsOptional()
  @IsBoolean()
  realTimeTracking?: boolean;

  @IsOptional()
  @IsBoolean()
  geofencingEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  speedAlertEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  maxSpeedAlert?: number;
}
