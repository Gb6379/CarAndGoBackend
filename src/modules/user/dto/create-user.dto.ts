import { IsEmail, IsString, IsEnum, IsOptional, IsDateString, MinLength, Validate } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserType } from '../enums/user-type.enum';
import { IsCpfCnpjValidator } from '../validators/cpf-cnpj.validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  @Validate(IsCpfCnpjValidator, { message: 'CPF ou CNPJ inválido.' })
  cpfCnpj: string;

  @Transform(({ value }) => {
    const userTypeMapping: { [key: string]: string } = {
      'quero alugar carros': 'lessee',
      'quero alugar meu carro': 'lessor',
      'ambos': 'both',
      'rent': 'lessee',
      'rent_out': 'lessor',
      'host': 'lessor',
    };
    const userTypeLower = value?.toLowerCase();
    return userTypeMapping[userTypeLower] || userTypeLower;
  })
  @IsEnum(UserType)
  userType: UserType;

  @IsString()
  phone: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  // Address Information
  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @IsString()
  complement?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  zipCode?: string;
}
