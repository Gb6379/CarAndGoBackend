import { Controller, Get, Post, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { FavoriteService } from './favorite.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateFavoriteDto } from './dto/create-favorite.dto';

@Controller('favorites')
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Req() req: any) {
    return this.favoriteService.findAllByUser(req.user.id);
  }

  @Get('ids')
  @UseGuards(JwtAuthGuard)
  getFavoriteIds(@Req() req: any) {
    return this.favoriteService.getFavoriteVehicleIds(req.user.id);
  }

  @Get('check/:vehicleId')
  @UseGuards(JwtAuthGuard)
  async check(@Req() req: any, @Param('vehicleId') vehicleId: string) {
    const isFavorite = await this.favoriteService.isFavorite(req.user.id, vehicleId);
    return { isFavorite };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  add(@Req() req: any, @Body() dto: CreateFavoriteDto) {
    return this.favoriteService.add(req.user.id, dto.vehicleId);
  }

  @Post('toggle')
  @UseGuards(JwtAuthGuard)
  toggle(@Req() req: any, @Body() dto: CreateFavoriteDto) {
    return this.favoriteService.toggle(req.user.id, dto.vehicleId);
  }

  @Delete(':vehicleId')
  @UseGuards(JwtAuthGuard)
  remove(@Req() req: any, @Param('vehicleId') vehicleId: string) {
    return this.favoriteService.remove(req.user.id, vehicleId);
  }
}
