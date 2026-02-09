import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ReviewService } from './review.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateReviewDto } from './dto/create-review.dto';

@Controller('vehicles')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get(':vehicleId/reviews')
  findByVehicle(@Param('vehicleId') vehicleId: string) {
    return this.reviewService.findByVehicle(vehicleId);
  }

  @Post(':vehicleId/reviews')
  @UseGuards(JwtAuthGuard)
  create(
    @Req() req: any,
    @Param('vehicleId') vehicleId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewService.create(req.user.id, vehicleId, dto);
  }

  @Put('reviews/:reviewId')
  @UseGuards(JwtAuthGuard)
  update(
    @Req() req: any,
    @Param('reviewId') reviewId: string,
    @Body() dto: Partial<CreateReviewDto>,
  ) {
    return this.reviewService.update(req.user.id, reviewId, dto);
  }

  @Delete('reviews/:reviewId')
  @UseGuards(JwtAuthGuard)
  remove(@Req() req: any, @Param('reviewId') reviewId: string) {
    return this.reviewService.remove(req.user.id, reviewId);
  }
}

