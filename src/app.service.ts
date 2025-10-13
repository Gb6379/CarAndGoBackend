import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return '🚗 Welcome to CAR AND GO API - Your Car Rental Platform!';
  }
}
