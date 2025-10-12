import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InspectionService } from './inspection.service';
import { InspectionController } from './inspection.controller';
import { Inspection } from './entities/inspection.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Inspection])],
  controllers: [InspectionController],
  providers: [InspectionService],
  exports: [InspectionService],
})
export class InspectionModule {}
