import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return '🚗 Welcome to Guape-CAR AND GO API - Your Car Rental Platform!';
  }
}
