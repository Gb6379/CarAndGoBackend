import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { GovBrService } from './services/gov-br.service';
import { UserService } from '../user/user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('gov-br')
export class GovBrController {
  constructor(
    private readonly govBrService: GovBrService,
    private readonly userService: UserService,
  ) {}

  @Get('auth-url')
  @UseGuards(JwtAuthGuard)
  generateAuthUrl(@Query('state') state: string) {
    return {
      authUrl: this.govBrService.generateAuthUrl(state || 'default'),
    };
  }

  @Post('callback')
  @UseGuards(JwtAuthGuard)
  async handleCallback(@Body() body: { code: string; state: string }) {
    try {
      const tokenData = await this.govBrService.exchangeCodeForToken(body.code);
      const userInfo = await this.govBrService.getUserInfo(tokenData.access_token);
      
      return {
        success: true,
        userInfo,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('validate-document')
  @UseGuards(JwtAuthGuard)
  async validateDocument(@Body() body: { document: string; type: 'CPF' | 'CNPJ' }, @Req() req: any) {
    try {
      const result = body.type === 'CPF' 
        ? await this.govBrService.validateCPF(body.document)
        : await this.govBrService.validateCNPJ(body.document);
      
      if (!result.isValid || result.isBlacklisted) {
        return {
          success: false,
          result,
          error: result.errors?.join(', ') || 'Documento inválido ou irregular.',
        };
      }

      // Para CPF: consultar antecedentes criminais; só marcar verificado se aprovado
      if (body.type === 'CPF') {
        const antecedentes = await this.govBrService.checkCriminalBackground(body.document);
        if (!antecedentes.isApproved) {
          return {
            success: false,
            result: { ...result, antecedentes },
            error: 'Não é possível concluir a verificação devido a restrições nos antecedentes. Entre em contato com o suporte.',
          };
        }
      }

      await this.userService.update(req.user.id, { documentsVerified: true });
      
      return {
        success: true,
        result: { ...result, documentsVerified: true },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('credit-analysis')
  @UseGuards(JwtAuthGuard)
  async performCreditAnalysis(@Body() body: {
    documentNumber: string;
    documentType: 'CPF' | 'CNPJ';
    additionalData?: {
      income?: number;
      employmentStatus?: string;
      address?: any;
    };
  }) {
    try {
      const result = await this.govBrService.performCreditAnalysis(
        body.documentNumber,
        body.documentType,
        body.additionalData
      );
      
      return {
        success: true,
        result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('criminal-background-check')
  @UseGuards(JwtAuthGuard)
  async checkCriminalBackground(@Body() body: { cpf: string }) {
    try {
      const result = await this.govBrService.checkCriminalBackground(body.cpf);
      
      return {
        success: true,
        result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('user-info')
  @UseGuards(JwtAuthGuard)
  async getUserInfo(@Query('accessToken') accessToken: string) {
    try {
      const userInfo = await this.govBrService.getUserInfo(accessToken);
      
      return {
        success: true,
        userInfo,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
