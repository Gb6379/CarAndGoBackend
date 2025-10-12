import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Booking } from './entities/booking.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { BookingCalculationService } from './services/booking-calculation.service';
import { RoutePlanningService } from './services/route-planning.service';
import { BookingStatus } from './enums/booking-status.enum';

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    private bookingCalculationService: BookingCalculationService,
    private routePlanningService: RoutePlanningService,
  ) {}

  async create(createBookingDto: CreateBookingDto): Promise<Booking> {
    // Validate booking dates
    const startDate = new Date(createBookingDto.startDate);
    const endDate = new Date(createBookingDto.endDate);
    
    const dateValidation = this.bookingCalculationService.validateBookingDates(startDate, endDate);
    if (!dateValidation.isValid) {
      throw new BadRequestException(dateValidation.error);
    }

    // Check vehicle availability
    const isAvailable = await this.checkVehicleAvailability(
      createBookingDto.vehicleId,
      startDate,
      endDate
    );
    
    if (!isAvailable) {
      throw new BadRequestException('Vehicle is not available for the selected dates');
    }

    // Calculate booking costs
    const calculation = this.bookingCalculationService.calculateBookingCost({
      startDate,
      endDate,
      dailyRate: createBookingDto.dailyRate,
      hourlyRate: createBookingDto.hourlyRate,
      securityDeposit: createBookingDto.securityDeposit,
    });

    // Plan route if coordinates are provided
    let routeData = null;
    if (createBookingDto.originLatitude && createBookingDto.originLongitude &&
        createBookingDto.destinationLatitude && createBookingDto.destinationLongitude) {
      const route = await this.routePlanningService.planRoute({
        originLatitude: createBookingDto.originLatitude,
        originLongitude: createBookingDto.originLongitude,
        destinationLatitude: createBookingDto.destinationLatitude,
        destinationLongitude: createBookingDto.destinationLongitude,
        originAddress: createBookingDto.originCity,
        destinationAddress: createBookingDto.destinationCity,
      });
      
      routeData = {
        distance: route.distance,
        duration: route.duration,
        routePoints: route.routePoints,
      };

      // Add distance fee to calculation
      const updatedCalculation = this.bookingCalculationService.calculateBookingCost({
        startDate,
        endDate,
        dailyRate: createBookingDto.dailyRate,
        hourlyRate: createBookingDto.hourlyRate,
        securityDeposit: createBookingDto.securityDeposit,
        distance: route.distance,
      });

      Object.assign(calculation, updatedCalculation);
    }

    const booking = this.bookingRepository.create({
      ...createBookingDto,
      startDate,
      endDate,
      totalAmount: calculation.totalAmount,
      platformFee: calculation.platformFee,
      lessorAmount: calculation.lessorAmount,
      plannedDistance: routeData?.distance || 0,
      scheduledRoute: routeData ? JSON.stringify(routeData.routePoints) : null,
    });

    return this.bookingRepository.save(booking);
  }

  async findAll(): Promise<Booking[]> {
    return this.bookingRepository.find({
      relations: ['lessee', 'lessor', 'vehicle'],
    });
  }

  async findOne(id: string): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: ['lessee', 'lessor', 'vehicle'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  async update(id: string, updateBookingDto: UpdateBookingDto): Promise<Booking> {
    const booking = await this.findOne(id);
    Object.assign(booking, updateBookingDto);
    return this.bookingRepository.save(booking);
  }

  async remove(id: string): Promise<void> {
    const booking = await this.findOne(id);
    await this.bookingRepository.remove(booking);
  }

  async findByLessee(lesseeId: string): Promise<Booking[]> {
    return this.bookingRepository.find({
      where: { lesseeId },
      relations: ['vehicle', 'lessor'],
    });
  }

  async findByLessor(lessorId: string): Promise<Booking[]> {
    return this.bookingRepository.find({
      where: { lessorId },
      relations: ['vehicle', 'lessee'],
    });
  }

  async findByVehicle(vehicleId: string): Promise<Booking[]> {
    return this.bookingRepository.find({
      where: { vehicleId },
      relations: ['lessee', 'lessor'],
    });
  }

  async checkVehicleAvailability(vehicleId: string, startDate: Date, endDate: Date): Promise<boolean> {
    const conflictingBookings = await this.bookingRepository.find({
      where: {
        vehicleId,
        status: BookingStatus.CONFIRMED,
        startDate: Between(startDate, endDate),
      },
    });

    // Also check for bookings that start before but end during the requested period
    const overlappingBookings = await this.bookingRepository.find({
      where: {
        vehicleId,
        status: BookingStatus.CONFIRMED,
        endDate: Between(startDate, endDate),
      },
    });

    return conflictingBookings.length === 0 && overlappingBookings.length === 0;
  }

  async confirmBooking(id: string): Promise<Booking> {
    const booking = await this.findOne(id);
    booking.status = BookingStatus.CONFIRMED;
    return this.bookingRepository.save(booking);
  }

  async startTrip(id: string, startMileage: number): Promise<Booking> {
    const booking = await this.findOne(id);
    booking.status = BookingStatus.ACTIVE;
    booking.actualStartDate = new Date();
    booking.startMileage = startMileage;
    return this.bookingRepository.save(booking);
  }

  async endTrip(id: string, endMileage: number, endPhotos: string[]): Promise<Booking> {
    const booking = await this.findOne(id);
    booking.status = BookingStatus.COMPLETED;
    booking.actualEndDate = new Date();
    booking.endMileage = endMileage;
    booking.endPhotos = JSON.stringify(endPhotos);
    booking.actualDistance = endMileage - booking.startMileage;
    return this.bookingRepository.save(booking);
  }

  async cancelBooking(id: string, reason: string): Promise<Booking> {
    const booking = await this.findOne(id);
    booking.status = BookingStatus.CANCELLED;
    booking.returnNotes = reason;
    return this.bookingRepository.save(booking);
  }

  async processEarlyReturn(id: string, earlyReturnDate: Date): Promise<Booking> {
    const booking = await this.findOne(id);
    
    const calculation = this.bookingCalculationService.calculateBookingCost({
      startDate: booking.startDate,
      endDate: booking.endDate,
      dailyRate: booking.dailyRate,
      hourlyRate: booking.hourlyRate,
      securityDeposit: booking.securityDeposit,
      isEarlyReturn: true,
      earlyReturnDate,
    });

    booking.earlyReturn = true;
    booking.earlyReturnDate = earlyReturnDate;
    booking.earlyReturnDiscount = calculation.earlyReturnDiscount || 0;
    booking.totalAmount = calculation.totalAmount;

    return this.bookingRepository.save(booking);
  }

  async getBookingStats(): Promise<{
    totalBookings: number;
    activeBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    totalRevenue: number;
  }> {
    const [total, active, completed, cancelled] = await Promise.all([
      this.bookingRepository.count(),
      this.bookingRepository.count({ where: { status: BookingStatus.ACTIVE } }),
      this.bookingRepository.count({ where: { status: BookingStatus.COMPLETED } }),
      this.bookingRepository.count({ where: { status: BookingStatus.CANCELLED } }),
    ]);

    const revenueResult = await this.bookingRepository
      .createQueryBuilder('booking')
      .select('SUM(booking.totalAmount)', 'totalRevenue')
      .where('booking.status = :status', { status: BookingStatus.COMPLETED })
      .getRawOne();

    return {
      totalBookings: total,
      activeBookings: active,
      completedBookings: completed,
      cancelledBookings: cancelled,
      totalRevenue: parseFloat(revenueResult.totalRevenue) || 0,
    };
  }
}
