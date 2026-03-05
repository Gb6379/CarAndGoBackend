import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './entities/vehicle.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { UserService } from '../user/user.service';

@Injectable()
export class VehicleService {
  constructor(
    @InjectRepository(Vehicle)
    private vehicleRepository: Repository<Vehicle>,
    private userService: UserService,
  ) {}

  async create(createVehicleDto: CreateVehicleDto, userId: string): Promise<Vehicle> {
    if (createVehicleDto.ownerId !== userId) {
      throw new ForbiddenException('Só é possível cadastrar veículos para sua própria conta.');
    }
    const user = await this.userService.findOne(userId);
    if (!user.documentsVerified) {
      throw new ForbiddenException(
        'É necessário completar a verificação de documentos (CPF e antecedentes) para anunciar veículos. Acesse Conta > Verificação.',
      );
    }
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
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new BadRequestException(`Invalid vehicle ID format. Expected UUID, got: ${id}`);
    }

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
    console.log('Search filters received:', JSON.stringify(filters, null, 2));
    
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
        // Split location by comma to handle "City, State" format
        const locationParts = location.split(',').map((part: string) => part.trim());
        
        if (locationParts.length >= 2) {
          // User provided "City, State" format - search for city AND state
          const cityPart = locationParts[0];
          const statePart = locationParts[1];
          query.andWhere(
            '(LOWER(vehicle.city) LIKE LOWER(:cityPart) OR LOWER(vehicle.address) LIKE LOWER(:cityPart))',
            { cityPart: `%${cityPart}%` }
          );
          // Optionally also match state if provided
          if (statePart.length === 2) {
            query.andWhere('LOWER(vehicle.state) = LOWER(:statePart)', { statePart });
          }
        } else {
          // Single search term - search across all location fields
          query.andWhere(
            '(LOWER(vehicle.city) LIKE LOWER(:location) OR LOWER(vehicle.address) LIKE LOWER(:location) OR LOWER(vehicle.state) LIKE LOWER(:location))',
            { location: `%${location}%` }
          );
        }
      }
    }

    // Vehicle type / fuel type filter (eletrico | combustao)
    if (filters.vehicleType && filters.vehicleType !== 'all') {
      if (filters.vehicleType === 'eletrico' || filters.vehicleType === 'combustao') {
        query.andWhere('vehicle.fuelType = :fuelType', { fuelType: filters.vehicleType });
      } else {
        query.andWhere('vehicle.type = :type', { type: filters.vehicleType });
      }
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
      query.andWhere('vehicle.fuelType = :fuelType', { fuelType: 'eletrico' });
    }

    // Rating filter
    if (filters.minRating) {
      query.andWhere('vehicle.rating >= :minRating', { minRating: filters.minRating });
    }

    // Date availability filter (check if vehicle is available during the requested period)
    // Only blocks if there's a booking that is pending, confirmed, or active
    // Completed, cancelled, rejected, and expired bookings don't block availability
    if (filters.fromDate && filters.untilDate) {
      console.log('Filtering by date availability:', filters.fromDate, 'to', filters.untilDate);
      
      // First, log existing bookings for debugging
      const existingBookings = await this.vehicleRepository.query(
        `SELECT id, "vehicleId", DATE("startDate") as start_date, DATE("endDate") as end_date, CAST(status AS TEXT) as status 
         FROM bookings 
         WHERE DATE("startDate") <= $1 AND DATE("endDate") >= $2`,
        [filters.untilDate, filters.fromDate]
      );
      console.log('Existing bookings that overlap with search period:', existingBookings);
      
      // Use DATE() function to compare only the date part, ignoring time
      // Use LOWER() for case-insensitive status comparison
      // Include awaiting_return as it still blocks the vehicle
      query.andWhere(
        `NOT EXISTS (
          SELECT 1 FROM bookings b 
          WHERE b."vehicleId" = vehicle.id 
          AND DATE(b."startDate") <= DATE(:untilDate)
          AND DATE(b."endDate") >= DATE(:fromDate)
          AND LOWER(CAST(b.status AS TEXT)) IN ('pending', 'confirmed', 'active', 'awaiting_return')
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
