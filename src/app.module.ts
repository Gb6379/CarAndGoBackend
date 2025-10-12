import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseConfig } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { VehicleModule } from './modules/vehicle/vehicle.module';
import { BookingModule } from './modules/booking/booking.module';
import { PaymentModule } from './modules/payment/payment.module';
import { InspectionModule } from './modules/inspection/inspection.module';
import { LocatorModule } from './modules/locator/locator.module';
import { GovBrModule } from './modules/gov-br/gov-br.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: 'config.env',
    }),
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),
    AuthModule,
    UserModule,
    VehicleModule,
    BookingModule,
    PaymentModule,
    InspectionModule,
    LocatorModule,
    GovBrModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
