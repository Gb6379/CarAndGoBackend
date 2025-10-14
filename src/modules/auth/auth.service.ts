import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { User } from '../user/entities/user.entity';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userService.findByEmail(email);
    if (user && await this.userService.validatePassword(user, password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { 
      email: user.email, 
      sub: user.id, 
      userType: user.userType,
      status: user.status 
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        status: user.status,
      },
    };
  }

  async register(createUserDto: any) {
    // Map Portuguese userType values to English enum values
    const userTypeMapping = {
      'quero alugar carros': 'lessee',      // Locatário
      'quero alugar meu carro': 'lessor',   // Locador
      'ambos': 'both',                       // Ambos
      'rent': 'lessee',                      // Alias for lessee
      'rent_out': 'lessor',                  // Alias for lessor
    };

    // Convert userType to lowercase for case-insensitive matching
    const userTypeLower = createUserDto.userType?.toLowerCase();
    const mappedUserType = userTypeMapping[userTypeLower] || userTypeLower;
    
    // Update the DTO with the mapped userType
    const mappedDto = {
      ...createUserDto,
      userType: mappedUserType,
    };

    const user = await this.userService.create(mappedDto);
    
    const payload = { 
      email: user.email, 
      sub: user.id, 
      userType: user.userType,
      status: user.status 
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        status: user.status,
      },
    };
  }
}
