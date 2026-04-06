import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'emailOrCpf',
      passwordField: 'password',
    });
  }

  async validate(emailOrCpf: string, password: string): Promise<any> {
    const user = await this.authService.validateUserByEmailOrCpf(emailOrCpf, password);
    if (!user) {
      const userExists = await this.authService.userService.findByEmailOrCpf(emailOrCpf);
      if (!userExists) {
        throw new UnauthorizedException('Usuário não encontrado. Cadastre-se primeiro.');
      } else {
        throw new UnauthorizedException('Senha incorreta. Tente novamente.');
      }
    }
    return user;
  }
}
