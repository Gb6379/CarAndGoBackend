import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './entities/favorite.entity';
import { Vehicle } from '../vehicle/entities/vehicle.entity';

@Injectable()
export class FavoriteService {
  constructor(
    @InjectRepository(Favorite)
    private favoriteRepository: Repository<Favorite>,
    @InjectRepository(Vehicle)
    private vehicleRepository: Repository<Vehicle>,
  ) {}

  async findAllByUser(userId: string): Promise<Favorite[]> {
    return this.favoriteRepository.find({
      where: { userId },
      relations: ['vehicle', 'vehicle.owner'],
      order: { createdAt: 'DESC' },
    });
  }

  async getFavoriteVehicleIds(userId: string): Promise<string[]> {
    const favorites = await this.favoriteRepository.find({
      where: { userId },
      select: ['vehicleId'],
    });
    return favorites.map((f) => f.vehicleId);
  }

  async isFavorite(userId: string, vehicleId: string): Promise<boolean> {
    const count = await this.favoriteRepository.count({
      where: { userId, vehicleId },
    });
    return count > 0;
  }

  async add(userId: string, vehicleId: string): Promise<Favorite> {
    const vehicle = await this.vehicleRepository.findOne({ where: { id: vehicleId } });
    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado');
    }
    const existing = await this.favoriteRepository.findOne({
      where: { userId, vehicleId },
    });
    if (existing) {
      return existing;
    }
    const favorite = this.favoriteRepository.create({ userId, vehicleId });
    return this.favoriteRepository.save(favorite);
  }

  async remove(userId: string, vehicleId: string): Promise<void> {
    const result = await this.favoriteRepository.delete({ userId, vehicleId });
    if (result.affected === 0) {
      // Idempotent: consider success if already not favorite
      return;
    }
  }

  async toggle(userId: string, vehicleId: string): Promise<{ isFavorite: boolean }> {
    const vehicle = await this.vehicleRepository.findOne({ where: { id: vehicleId } });
    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado');
    }
    const existing = await this.favoriteRepository.findOne({
      where: { userId, vehicleId },
    });
    if (existing) {
      await this.favoriteRepository.remove(existing);
      return { isFavorite: false };
    }
    const favorite = this.favoriteRepository.create({ userId, vehicleId });
    await this.favoriteRepository.save(favorite);
    return { isFavorite: true };
  }
}
