import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { User } from '../user/entities/user.entity';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    public userService: UserService,
    private jwtService: JwtService,
  ) {}

  private buildAuthUserPayload(user: User, userTypeOverride?: string) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      userType: userTypeOverride ?? user.userType,
      status: user.status,
      documentsVerified: user.documentsVerified ?? false,
      profilePhoto: user.profilePhoto ?? undefined,
      cpfCnpj: user.cpfCnpj ?? '',
      phone: user.phone ?? '',
      city: user.city ?? '',
      state: user.state ?? '',
    };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userService.findByEmail(email);
    if (user && await this.userService.validatePassword(user, password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  /** Valida usuário por e-mail ou CPF/CNPJ (para login de locador/locatário). */
  async validateUserByEmailOrCpf(emailOrCpf: string, password: string): Promise<any> {
    const user = await this.userService.findByEmailOrCpf(emailOrCpf);
    if (user && await this.userService.validatePassword(user, password)) {
      const { password: _, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const adminEmails = (process.env.ADMIN_EMAIL || '').split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean);
    const isAdmin = adminEmails.includes(user.email?.toLowerCase());
    const userType = isAdmin ? 'admin' : user.userType;

    const payload = {
      email: user.email,
      sub: user.id,
      userType,
      status: user.status,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: this.buildAuthUserPayload(user, userType),
    };
  }

  async register(createUserDto: any) {
    const user = await this.userService.create(createUserDto);
    
    const payload = { 
      email: user.email, 
      sub: user.id, 
      userType: user.userType,
      status: user.status 
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: this.buildAuthUserPayload(user),
    };
  }
}
