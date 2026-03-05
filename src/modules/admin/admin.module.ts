import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { UserModule } from '../user/user.module';
import { BookingModule } from '../booking/booking.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, UserModule, BookingModule],
  controllers: [AdminController],
})
export class AdminModule {}
