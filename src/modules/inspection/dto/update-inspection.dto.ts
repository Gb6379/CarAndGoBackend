import { PartialType } from '@nestjs/mapped-types';
import { CreateInspectionDto } from './create-inspection.dto';
import { IsOptional, IsBoolean, IsNumber, IsString, IsArray, IsDateString } from 'class-validator';

export class UpdateInspectionDto extends PartialType(CreateInspectionDto) {
  @IsOptional()
  @IsDateString()
  actualDate?: string;

  @IsOptional()
  @IsBoolean()
  exteriorPassed?: boolean;

  @IsOptional()
  @IsBoolean()
  interiorPassed?: boolean;

  @IsOptional()
  @IsBoolean()
  mechanicalPassed?: boolean;

  @IsOptional()
  @IsBoolean()
  documentsPassed?: boolean;

  @IsOptional()
  @IsBoolean()
  safetyPassed?: boolean;

  @IsOptional()
  @IsNumber()
  overallScore?: number;

  @IsOptional()
  @IsArray()
  photos?: string[];

  @IsOptional()
  @IsString()
  inspectionReport?: string;

  @IsOptional()
  @IsString()
  inspectorName?: string;

  @IsOptional()
  @IsString()
  inspectorLicense?: string;

  @IsOptional()
  @IsString()
  inspectorSignature?: string;
}
