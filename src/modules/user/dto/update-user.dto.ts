import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsString, IsBoolean, IsNumber } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsString()
  profilePhoto?: string;

  @IsOptional()
  @IsBoolean()
  documentsVerified?: boolean;

  @IsOptional()
  @IsString()
  govBrId?: string;

  @IsOptional()
  @IsNumber()
  creditScore?: number;

  @IsOptional()
  @IsBoolean()
  criminalBackgroundCheck?: boolean;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAgency?: string;

  @IsOptional()
  @IsString()
  bankAccount?: string;

  @IsOptional()
  @IsString()
  bankAccountType?: string;

  @IsOptional()
  @IsString()
  bankHolderName?: string;

  @IsOptional()
  @IsString()
  bankHolderDocument?: string;

  @IsOptional()
  @IsString()
  pixKey?: string;
}
