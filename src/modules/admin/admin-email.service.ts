import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { User } from '../user/entities/user.entity';

@Injectable()
export class AdminEmailService {
  private readonly logger = new Logger(AdminEmailService.name);
  private transporter: nodemailer.Transporter | null | undefined;
  private missingConfigLogged = false;

  constructor(private readonly configService: ConfigService) {}

  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter !== undefined) {
      return this.transporter;
    }

    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const port = Number(this.configService.get<string>('SMTP_PORT') || 587);
    const secureValue = String(this.configService.get<string>('SMTP_SECURE') || '').toLowerCase();
    const secure = secureValue ? secureValue === 'true' : port === 465;

    if (!host || !user || !pass) {
      if (!this.missingConfigLogged) {
        this.logger.warn('SMTP is not configured. Document approval emails will be skipped.');
        this.missingConfigLogged = true;
      }
      this.transporter = null;
      return this.transporter;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    return this.transporter;
  }

  async sendDocumentsApprovedEmail(user: Pick<User, 'email' | 'firstName' | 'lastName'>): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter || !user.email) {
      return false;
    }

    const firstName = (user.firstName || '').trim() || 'cliente';
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || firstName;
    const from =
      this.configService.get<string>('SMTP_FROM') ||
      this.configService.get<string>('SMTP_USER') ||
      'no-reply@carandgo.com.br';

    try {
      await transporter.sendMail({
        from,
        to: user.email,
        subject: 'Seus documentos foram aprovados na CarGo',
        text: [
          `Ola, ${firstName}!`,
          '',
          'Seus documentos foram aprovados pela nossa equipe.',
          'Sua conta ja esta liberada para continuar o processo na plataforma.',
          '',
          'Se precisar de ajuda, entre em contato com o suporte da CarGo.',
          '',
          `Atenciosamente,`,
          'Equipe CarGo',
        ].join('\n'),
        html: `
          <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
            <p>Olá, ${firstName}!</p>
            <p>Seus documentos foram aprovados pela nossa equipe.</p>
            <p>Sua conta já está liberada para continuar o processo na plataforma.</p>
            <p>Se precisar de ajuda, entre em contato com o suporte da CarGo.</p>
            <p>Atenciosamente,<br />Equipe CarGo</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <small style="color: #6b7280;">Este e-mail foi enviado para ${fullName}.</small>
          </div>
        `,
      });

      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send document approval email to ${user.email}`, error?.stack || String(error));
      return false;
    }
  }
}
