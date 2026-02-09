import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { Vehicle } from '../vehicle/entities/vehicle.entity';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,
    @InjectRepository(Vehicle)
    private vehicleRepository: Repository<Vehicle>,
  ) {}

  async findByVehicle(vehicleId: string): Promise<any[]> {
    await this.ensureVehicleExists(vehicleId);
    const reviews = await this.reviewRepository.find({
      where: { vehicleId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
    return reviews.map((r) => this.sanitizeReview(r));
  }

  private sanitizeReview(r: Review | null): any {
    if (!r) return r;
    return {
      ...r,
      user: r.user ? { id: r.user.id, firstName: r.user.firstName, lastName: r.user.lastName } : null,
    };
  }

  async create(userId: string, vehicleId: string, dto: CreateReviewDto): Promise<Review> {
    await this.ensureVehicleExists(vehicleId);
    const existing = await this.reviewRepository.findOne({
      where: { userId, vehicleId },
    });
    if (existing) {
      throw new BadRequestException('Você já avaliou este veículo. Edite sua avaliação existente.');
    }
    const review = this.reviewRepository.create({
      userId,
      vehicleId,
      rating: dto.rating,
      comment: dto.comment ?? null,
    });
    const saved = await this.reviewRepository.save(review);
    await this.updateVehicleRating(vehicleId);
    const created = await this.reviewRepository.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });
    return this.sanitizeReview(created);
  }

  async update(userId: string, reviewId: string, dto: Partial<CreateReviewDto>): Promise<Review> {
    const review = await this.reviewRepository.findOne({
      where: { id: reviewId },
    });
    if (!review) {
      throw new NotFoundException('Avaliação não encontrada');
    }
    if (review.userId !== userId) {
      throw new BadRequestException('Você só pode editar sua própria avaliação');
    }
    if (dto.rating !== undefined) review.rating = dto.rating;
    if (dto.comment !== undefined) review.comment = dto.comment;
    await this.reviewRepository.save(review);
    await this.updateVehicleRating(review.vehicleId);
    const updated = await this.reviewRepository.findOne({
      where: { id: reviewId },
      relations: ['user'],
    });
    return this.sanitizeReview(updated);
  }

  async remove(userId: string, reviewId: string): Promise<void> {
    const review = await this.reviewRepository.findOne({
      where: { id: reviewId },
    });
    if (!review) {
      throw new NotFoundException('Avaliação não encontrada');
    }
    if (review.userId !== userId) {
      throw new BadRequestException('Você só pode excluir sua própria avaliação');
    }
    const vehicleId = review.vehicleId;
    await this.reviewRepository.remove(review);
    await this.updateVehicleRating(vehicleId);
  }

  private async ensureVehicleExists(vehicleId: string): Promise<void> {
    const vehicle = await this.vehicleRepository.findOne({ where: { id: vehicleId } });
    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado');
    }
  }

  private async updateVehicleRating(vehicleId: string): Promise<void> {
    const result = await this.reviewRepository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'avg')
      .where('review.vehicleId = :vehicleId', { vehicleId })
      .getRawOne();
    const avg = result?.avg ? parseFloat(parseFloat(result.avg).toFixed(2)) : null;
    await this.vehicleRepository.update(vehicleId, { rating: avg });
  }
}
