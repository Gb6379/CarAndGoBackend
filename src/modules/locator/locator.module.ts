import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocatorService } from './locator.service';
import { LocatorController } from './locator.controller';
import { LocatorDevice } from './entities/locator-device.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LocatorDevice])],
  controllers: [LocatorController],
  providers: [LocatorService],
  exports: [LocatorService],
})
export class LocatorModule {}
