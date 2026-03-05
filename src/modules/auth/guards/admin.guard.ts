import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.email) {
      throw new ForbiddenException('Acesso negado.');
    }
    const adminEmails = (this.configService.get<string>('ADMIN_EMAIL') || '')
      .split(',')
      .map((e: string) => e.trim().toLowerCase())
      .filter(Boolean);
    const isAdmin = adminEmails.includes(user.email.toLowerCase());
    if (!isAdmin) {
      throw new ForbiddenException('Acesso restrito a administradores.');
    }
    return true;
  }
}
