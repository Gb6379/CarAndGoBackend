import { PartialType } from '@nestjs/mapped-types';
import { CreateLocatorDeviceDto } from './create-locator-device.dto';
import { IsOptional, IsDateString, IsString, IsNumber } from 'class-validator';

export class UpdateLocatorDeviceDto extends PartialType(CreateLocatorDeviceDto) {
  @IsOptional()
  @IsDateString()
  lastSeen?: string;

  @IsOptional()
  @IsDateString()
  installationDate?: string;

  @IsOptional()
  @IsString()
  installationLocation?: string;

  @IsOptional()
  @IsNumber()
  installationLatitude?: number;

  @IsOptional()
  @IsNumber()
  installationLongitude?: number;

  @IsOptional()
  @IsString()
  installerName?: string;

  @IsOptional()
  @IsString()
  installerLicense?: string;
}
