import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './entities/vehicle.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehicleService {
  constructor(
    @InjectRepository(Vehicle)
    private vehicleRepository: Repository<Vehicle>,
  ) {}

  async create(createVehicleDto: CreateVehicleDto): Promise<Vehicle> {
    try {
      console.log('Creating vehicle with data:', createVehicleDto);
      const vehicle = this.vehicleRepository.create(createVehicleDto);
      const savedVehicle = await this.vehicleRepository.save(vehicle);
      console.log('Vehicle created successfully:', savedVehicle.id);
      return savedVehicle;
    } catch (error) {
      console.error('Error creating vehicle:', error);
      throw error;
    }
  }

  async findAll(): Promise<Vehicle[]> {
    return this.vehicleRepository.find({
      relations: ['owner'],
      where: { isActive: true },
    });
  }

  async findOne(id: string): Promise<Vehicle> {
    const vehicle = await this.vehicleRepository.findOne({
      where: { id },
      relations: ['owner', 'bookings'],
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    return vehicle;
  }

  async update(id: string, updateVehicleDto: UpdateVehicleDto): Promise<Vehicle> {
    const vehicle = await this.findOne(id);
    Object.assign(vehicle, updateVehicleDto);
    return this.vehicleRepository.save(vehicle);
  }

  async remove(id: string): Promise<void> {
    const vehicle = await this.findOne(id);
    await this.vehicleRepository.remove(vehicle);
  }

  async findByOwner(ownerId: string): Promise<Vehicle[]> {
    return this.vehicleRepository.find({
      where: { ownerId },
      relations: ['owner'],
    });
  }

  async searchVehicles(filters: any): Promise<Vehicle[]> {
    const query = this.vehicleRepository.createQueryBuilder('vehicle')
      .leftJoinAndSelect('vehicle.owner', 'owner')
      .where('vehicle.isActive = :isActive', { isActive: true })
      .andWhere('vehicle.status IN (:...statuses)', { statuses: ['active', 'pending'] });

    // Location filters - improved to handle both text and coordinate-based search
    if (filters.location || filters.city) {
      const location = filters.location || filters.city;
      
      // If user provided coordinates, search by proximity
      if (filters.userLat && filters.userLng) {
        // Search within 50km radius (approximately)
        query.andWhere(
          `(6371 * acos(cos(radians(:userLat)) * cos(radians(vehicle.latitude)) * cos(radians(vehicle.longitude) - radians(:userLng)) + sin(radians(:userLat)) * sin(radians(vehicle.latitude)))) <= :radius`,
          { 
            userLat: filters.userLat, 
            userLng: filters.userLng, 
            radius: 50 
          }
        );
      } else {
        // Text-based location search
        query.andWhere(
          '(LOWER(vehicle.city) LIKE LOWER(:location) OR LOWER(vehicle.address) LIKE LOWER(:location) OR LOWER(vehicle.state) LIKE LOWER(:location))',
          { location: `%${location}%` }
        );
      }
    }

    // Vehicle type filter
    if (filters.vehicleType && filters.vehicleType !== 'all') {
      query.andWhere('vehicle.type = :type', { type: filters.vehicleType });
    }

    // Price range filter
    if (filters.minPrice) {
      query.andWhere('vehicle.dailyRate >= :minPrice', { minPrice: filters.minPrice });
    }
    if (filters.maxPrice) {
      query.andWhere('vehicle.dailyRate <= :maxPrice', { maxPrice: filters.maxPrice });
    }

    // Make and model filter
    if (filters.makeModel && filters.makeModel !== 'all') {
      query.andWhere(
        '(LOWER(vehicle.make) LIKE LOWER(:makeModel) OR LOWER(vehicle.model) LIKE LOWER(:makeModel))',
        { makeModel: `%${filters.makeModel}%` }
      );
    }

    // Year filter
    if (filters.year && filters.year !== 'all') {
      query.andWhere('vehicle.year = :year', { year: filters.year });
    }

    // Seats filter
    if (filters.seats && filters.seats !== 'all') {
      query.andWhere('vehicle.seats >= :seats', { seats: filters.seats });
    }

    // Electric vehicles filter
    if (filters.electric === 'true') {
      query.andWhere('vehicle.fuelType = :fuelType', { fuelType: 'ELECTRIC' });
    }

    // Rating filter
    if (filters.minRating) {
      query.andWhere('vehicle.rating >= :minRating', { minRating: filters.minRating });
    }

    // Date availability filter (check if vehicle is available during the requested period)
    if (filters.fromDate && filters.untilDate) {
      query.andWhere(
        `vehicle.id NOT IN (
          SELECT DISTINCT b.vehicleId 
          FROM bookings b 
          WHERE b.status IN ('CONFIRMED', 'ACTIVE')
          AND (
            (b.startDate <= :untilDate AND b.endDate >= :fromDate)
          )
        )`,
        { fromDate: filters.fromDate, untilDate: filters.untilDate }
      );
    }

    // Sorting
    const sortBy = filters.sortBy || 'dailyRate';
    const sortOrder = filters.sortOrder || 'ASC';
    
    switch (sortBy) {
      case 'price':
        query.orderBy('vehicle.dailyRate', sortOrder as 'ASC' | 'DESC');
        break;
      case 'rating':
        query.orderBy('vehicle.rating', sortOrder as 'ASC' | 'DESC');
        break;
      case 'distance':
        // For distance sorting, we'll need coordinates
        if (filters.userLat && filters.userLng) {
          query.addSelect(
            `(6371 * acos(cos(radians(:userLat)) * cos(radians(vehicle.latitude)) * cos(radians(vehicle.longitude) - radians(:userLng)) + sin(radians(:userLat)) * sin(radians(vehicle.latitude))))`,
            'distance'
          );
          query.orderBy('distance', sortOrder as 'ASC' | 'DESC');
        } else {
          // Fallback to daily rate if no coordinates
          query.orderBy('vehicle.dailyRate', sortOrder as 'ASC' | 'DESC');
        }
        break;
      default:
        query.orderBy('vehicle.createdAt', 'DESC');
    }

    return query.getMany();
  }
}
