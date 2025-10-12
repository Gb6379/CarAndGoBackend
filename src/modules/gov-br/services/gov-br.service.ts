import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface GovBrUserInfo {
  sub: string; // CPF
  name: string;
  email: string;
  email_verified: boolean;
  phone_number?: string;
  phone_number_verified?: boolean;
  given_name: string;
  family_name: string;
  birthdate?: string;
  gender?: string;
  address?: {
    street_address?: string;
    locality?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  };
}

export interface DocumentValidationResult {
  isValid: boolean;
  documentType: 'CPF' | 'CNPJ';
  documentNumber: string;
  isActive: boolean;
  isBlacklisted: boolean;
  name?: string;
  birthDate?: string;
  errors?: string[];
}

export interface CreditAnalysisResult {
  score: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendations: string[];
  isApproved: boolean;
  maxCreditLimit?: number;
}

@Injectable()
export class GovBrService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly baseUrl = 'https://sso.acesso.gov.br';

  constructor(private configService: ConfigService) {
    this.clientId = this.configService.get<string>('GOV_BR_CLIENT_ID');
    this.clientSecret = this.configService.get<string>('GOV_BR_CLIENT_SECRET');
    this.redirectUri = this.configService.get<string>('GOV_BR_REDIRECT_URI');
  }

  /**
   * Generate authorization URL for GOV.BR login
   */
  generateAuthUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'openid profile email',
      state: state,
      nonce: this.generateNonce(),
    });

    return `${this.baseUrl}/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/token`,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.redirectUri,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('GOV.BR token exchange error:', error);
      throw new BadRequestException('Failed to exchange code for token');
    }
  }

  /**
   * Get user information from GOV.BR
   */
  async getUserInfo(accessToken: string): Promise<GovBrUserInfo> {
    try {
      const response = await axios.get(`${this.baseUrl}/userinfo`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error('GOV.BR user info error:', error);
      throw new BadRequestException('Failed to get user information from GOV.BR');
    }
  }

  /**
   * Validate CPF document
   */
  async validateCPF(cpf: string): Promise<DocumentValidationResult> {
    const cleanCpf = cpf.replace(/\D/g, '');
    
    // Basic CPF validation
    if (!this.isValidCPFFormat(cleanCpf)) {
      return {
        isValid: false,
        documentType: 'CPF',
        documentNumber: cleanCpf,
        isActive: false,
        isBlacklisted: false,
        errors: ['Invalid CPF format'],
      };
    }

    // Check if CPF is blacklisted (simplified - in production, integrate with official APIs)
    const isBlacklisted = await this.checkCPFBlacklist(cleanCpf);
    
    return {
      isValid: true,
      documentType: 'CPF',
      documentNumber: cleanCpf,
      isActive: true,
      isBlacklisted,
      errors: isBlacklisted ? ['CPF is blacklisted'] : [],
    };
  }

  /**
   * Validate CNPJ document
   */
  async validateCNPJ(cnpj: string): Promise<DocumentValidationResult> {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    
    // Basic CNPJ validation
    if (!this.isValidCNPJFormat(cleanCnpj)) {
      return {
        isValid: false,
        documentType: 'CNPJ',
        documentNumber: cleanCnpj,
        isActive: false,
        isBlacklisted: false,
        errors: ['Invalid CNPJ format'],
      };
    }

    // Check if CNPJ is blacklisted (simplified - in production, integrate with official APIs)
    const isBlacklisted = await this.checkCNPJBlacklist(cleanCnpj);
    
    return {
      isValid: true,
      documentType: 'CNPJ',
      documentNumber: cleanCnpj,
      isActive: true,
      isBlacklisted,
      errors: isBlacklisted ? ['CNPJ is blacklisted'] : [],
    };
  }

  /**
   * Perform credit analysis based on document and other factors
   */
  async performCreditAnalysis(
    documentNumber: string,
    documentType: 'CPF' | 'CNPJ',
    additionalData?: {
      income?: number;
      employmentStatus?: string;
      address?: any;
    }
  ): Promise<CreditAnalysisResult> {
    // This is a simplified credit analysis
    // In production, integrate with official credit bureaus like SPC, Serasa, etc.
    
    const baseScore = 500;
    let score = baseScore;
    const recommendations: string[] = [];

    // Document validation
    const documentValidation = documentType === 'CPF' 
      ? await this.validateCPF(documentNumber)
      : await this.validateCNPJ(documentNumber);

    if (!documentValidation.isValid || documentValidation.isBlacklisted) {
      return {
        score: 0,
        riskLevel: 'HIGH',
        recommendations: ['Document validation failed'],
        isApproved: false,
      };
    }

    // Income analysis
    if (additionalData?.income) {
      if (additionalData.income > 10000) {
        score += 100;
        recommendations.push('High income level');
      } else if (additionalData.income > 5000) {
        score += 50;
        recommendations.push('Medium income level');
      } else if (additionalData.income < 2000) {
        score -= 100;
        recommendations.push('Low income level - consider additional guarantees');
      }
    }

    // Employment status analysis
    if (additionalData?.employmentStatus) {
      switch (additionalData.employmentStatus.toLowerCase()) {
        case 'employed':
          score += 50;
          recommendations.push('Stable employment');
          break;
        case 'self-employed':
          score += 25;
          recommendations.push('Self-employment status');
          break;
        case 'unemployed':
          score -= 150;
          recommendations.push('Unemployment status - high risk');
          break;
      }
    }

    // Address analysis (simplified)
    if (additionalData?.address) {
      score += 25;
      recommendations.push('Address verified');
    }

    // Determine risk level and approval
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    let isApproved: boolean;
    let maxCreditLimit: number;

    if (score >= 700) {
      riskLevel = 'LOW';
      isApproved = true;
      maxCreditLimit = 50000;
    } else if (score >= 500) {
      riskLevel = 'MEDIUM';
      isApproved = true;
      maxCreditLimit = 25000;
    } else {
      riskLevel = 'HIGH';
      isApproved = false;
      maxCreditLimit = 0;
    }

    if (!isApproved) {
      recommendations.push('Credit analysis failed - consider alternative options');
    }

    return {
      score,
      riskLevel,
      recommendations,
      isApproved,
      maxCreditLimit,
    };
  }

  /**
   * Check criminal background (simplified implementation)
   */
  async checkCriminalBackground(cpf: string): Promise<{
    hasCriminalRecord: boolean;
    records: string[];
    isApproved: boolean;
  }> {
    // This is a simplified implementation
    // In production, integrate with official criminal background check services
    
    const cleanCpf = cpf.replace(/\D/g, '');
    
    // Mock data - in production, query official databases
    const mockCriminalRecords: { [key: string]: string[] } = {
      '12345678901': ['Theft', 'Fraud'],
      '98765432100': [],
    };

    const records = mockCriminalRecords[cleanCpf] || [];
    const hasCriminalRecord = records.length > 0;
    
    return {
      hasCriminalRecord,
      records,
      isApproved: !hasCriminalRecord,
    };
  }

  private isValidCPFFormat(cpf: string): boolean {
    if (cpf.length !== 11) return false;
    
    // Check for invalid sequences
    if (/^(\d)\1{10}$/.test(cpf)) return false;
    
    // Calculate verification digits
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cpf[i]) * (10 - i);
    }
    let digit1 = (sum * 10) % 11;
    if (digit1 === 10) digit1 = 0;
    
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cpf[i]) * (11 - i);
    }
    let digit2 = (sum * 10) % 11;
    if (digit2 === 10) digit2 = 0;
    
    return digit1 === parseInt(cpf[9]) && digit2 === parseInt(cpf[10]);
  }

  private isValidCNPJFormat(cnpj: string): boolean {
    if (cnpj.length !== 14) return false;
    
    // Check for invalid sequences
    if (/^(\d)\1{13}$/.test(cnpj)) return false;
    
    // Calculate verification digits
    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cnpj[i]) * weights1[i];
    }
    let digit1 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    
    sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(cnpj[i]) * weights2[i];
    }
    let digit2 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    
    return digit1 === parseInt(cnpj[12]) && digit2 === parseInt(cnpj[13]);
  }

  private async checkCPFBlacklist(cpf: string): Promise<boolean> {
    // Mock implementation - in production, integrate with official blacklist APIs
    const blacklistedCPFs = ['12345678901', '11111111111', '00000000000'];
    return blacklistedCPFs.includes(cpf);
  }

  private async checkCNPJBlacklist(cnpj: string): Promise<boolean> {
    // Mock implementation - in production, integrate with official blacklist APIs
    const blacklistedCNPJs = ['11111111000111', '00000000000000'];
    return blacklistedCNPJs.includes(cnpj);
  }

  private generateNonce(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}
