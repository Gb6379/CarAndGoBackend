import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FavoriteService } from './favorite.service';
import { FavoriteController } from './favorite.controller';
import { Favorite } from './entities/favorite.entity';
import { Vehicle } from '../vehicle/entities/vehicle.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Favorite, Vehicle]),
  ],
  controllers: [FavoriteController],
  providers: [FavoriteService],
  exports: [FavoriteService],
})
export class FavoriteModule {}
