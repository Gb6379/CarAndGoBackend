import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  /** E-mail ou CPF/CNPJ do usuário */
  @IsString()
  @MinLength(1, { message: 'Informe o e-mail ou CPF' })
  emailOrCpf: string;

  @IsString()
  @MinLength(6)
  password: string;
}
