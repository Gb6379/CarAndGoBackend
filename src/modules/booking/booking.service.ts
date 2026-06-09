import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { Booking } from './entities/booking.entity';
import { Vehicle } from '../vehicle/entities/vehicle.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { BookingCalculationService } from './services/booking-calculation.service';
import { RoutePlanningService } from './services/route-planning.service';
import { BookingStatus } from './enums/booking-status.enum';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);
  private transporter: nodemailer.Transporter | null | undefined;
  private missingSmtpLogged = false;

  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Vehicle)
    private vehicleRepository: Repository<Vehicle>,
    private bookingCalculationService: BookingCalculationService,
    private routePlanningService: RoutePlanningService,
    private configService: ConfigService,
  ) {}

  async create(createBookingDto: CreateBookingDto): Promise<Booking> {
    const vehicle = await this.vehicleRepository.findOne({
      where: { id: createBookingDto.vehicleId },
    });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

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

    // Calculate security deposit if not provided (default: 2x daily rate)
    const securityDeposit = createBookingDto.securityDeposit || (createBookingDto.dailyRate * 2);

    // Calculate booking costs
    const calculation = this.bookingCalculationService.calculateBookingCost({
      startDate,
      endDate,
      dailyRate: createBookingDto.dailyRate,
      hourlyRate: createBookingDto.hourlyRate,
      securityDeposit,
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
        securityDeposit,
        distance: route.distance,
      });

      Object.assign(calculation, updatedCalculation);
    }

    const booking = this.bookingRepository.create({
      ...createBookingDto,
      status: vehicle.autoApproveBookings ? BookingStatus.CONFIRMED : (createBookingDto.status || BookingStatus.PENDING),
      startDate,
      endDate,
      totalAmount: calculation.totalAmount,
      platformFee: calculation.platformFee,
      lessorAmount: calculation.lessorAmount,
      securityDeposit,
      plannedDistance: routeData?.distance || 0,
      scheduledRoute: routeData ? JSON.stringify(routeData.routePoints) : null,
    });

    const savedBooking = await this.bookingRepository.save(booking);
    if (vehicle.autoApproveBookings) {
      void this.sendReadyToPayEmail(savedBooking.id);
    } else {
      void this.sendPendingApprovalEmail(savedBooking.id);
    }
    return savedBooking;
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
    try {
      // Check for any overlapping bookings that would block this period
      // Using raw SQL to avoid enum issues
      // Statuses that block: pending, confirmed, active, awaiting_return
      const overlappingBookings = await this.bookingRepository.query(
        `SELECT id FROM bookings 
         WHERE "vehicleId" = $1 
         AND "startDate" <= $2 
         AND "endDate" >= $3
         AND LOWER(CAST(status AS TEXT)) IN ('pending', 'confirmed', 'active', 'awaiting_return')`,
        [vehicleId, endDate, startDate]
      );

      return overlappingBookings.length === 0;
    } catch (error) {
      // If there's an error (e.g., no bookings table data yet), assume available
      console.error('Error checking availability:', error);
      return true;
    }
  }

  async getVehicleBlockedDates(vehicleId: string): Promise<{ startDate: Date; endDate: Date; status: string }[]> {
    try {
      // Get all bookings that block dates using raw SQL to avoid enum issues
      // Statuses that block: pending, confirmed, active, awaiting_return
      const bookings = await this.bookingRepository.query(
        `SELECT "startDate", "endDate", CAST(status AS TEXT) as status 
         FROM bookings 
         WHERE "vehicleId" = $1 
         AND LOWER(CAST(status AS TEXT)) IN ('pending', 'confirmed', 'active', 'awaiting_return')
         ORDER BY "startDate" ASC`,
        [vehicleId]
      );

      return bookings.map((booking: any) => ({
        startDate: booking.startDate,
        endDate: booking.endDate,
        status: booking.status,
      }));
    } catch (error) {
      // If there's an error, return empty array
      console.error('Error getting blocked dates:', error);
      return [];
    }
  }

  async confirmBooking(id: string): Promise<Booking> {
    const booking = await this.findOne(id);
    booking.status = BookingStatus.CONFIRMED;
    const savedBooking = await this.bookingRepository.save(booking);
    void this.sendReadyToPayEmail(savedBooking.id);
    return savedBooking;
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

  async rejectBooking(id: string, reason?: string): Promise<Booking> {
    const booking = await this.findOne(id);
    const status = String(booking.status).toLowerCase();
    if (status !== 'pending') {
      throw new BadRequestException('Only pending bookings can be rejected');
    }
    booking.status = BookingStatus.REJECTED;
    if (reason) {
      booking.returnNotes = reason;
    }
    return this.bookingRepository.save(booking);
  }

  async confirmReturn(id: string, notes?: string): Promise<Booking> {
    const booking = await this.findOne(id);
    const status = String(booking.status).toLowerCase();
    if (status !== 'awaiting_return' && status !== 'active') {
      throw new BadRequestException('Only active or awaiting return bookings can be marked as completed');
    }
    booking.status = BookingStatus.COMPLETED;
    booking.returnCompleted = true;
    booking.returnTime = new Date();
    if (notes) {
      booking.returnNotes = notes;
    }
    return this.bookingRepository.save(booking);
  }

  // Check for bookings that have reached their end date and update status
  async checkAndUpdateAwaitingReturn(): Promise<number> {
    try {
      const now = new Date();
      
      // Find all ACTIVE or CONFIRMED bookings where endDate has passed using raw SQL
      const bookingsToUpdate = await this.bookingRepository.query(
        `SELECT id FROM bookings 
         WHERE LOWER(CAST(status AS TEXT)) IN ('active', 'confirmed')
         AND "endDate" <= $1`,
        [now]
      );
      
      let updatedCount = 0;
      for (const row of bookingsToUpdate) {
        // Update status to awaiting_return
        await this.bookingRepository.query(
          `UPDATE bookings SET status = 'awaiting_return' WHERE id = $1`,
          [row.id]
        );
        updatedCount++;
      }
      
      console.log(`Updated ${updatedCount} bookings to AWAITING_RETURN status`);
      return updatedCount;
    } catch (error) {
      console.error('Error in checkAndUpdateAwaitingReturn:', error);
      return 0;
    }
  }

  // Get pending bookings for a lessor (vehicle owner)
  async getPendingBookingsForLessor(lessorId: string): Promise<Booking[]> {
    try {
      return await this.bookingRepository
        .createQueryBuilder('booking')
        .leftJoinAndSelect('booking.lessee', 'lessee')
        .leftJoinAndSelect('booking.vehicle', 'vehicle')
        .where('booking.lessorId = :lessorId', { lessorId })
        .andWhere('LOWER(CAST(booking.status AS TEXT)) = :status', { status: 'pending' })
        .orderBy('booking.createdAt', 'DESC')
        .getMany();
    } catch (error) {
      console.error('Error getting pending bookings:', error);
      return [];
    }
  }

  // Get bookings awaiting return confirmation for a lessor
  async getAwaitingReturnForLessor(lessorId: string): Promise<Booking[]> {
    try {
      return await this.bookingRepository
        .createQueryBuilder('booking')
        .leftJoinAndSelect('booking.lessee', 'lessee')
        .leftJoinAndSelect('booking.vehicle', 'vehicle')
        .where('booking.lessorId = :lessorId', { lessorId })
        .andWhere('LOWER(CAST(booking.status AS TEXT)) = :status', { status: 'awaiting_return' })
        .orderBy('booking.endDate', 'ASC')
        .getMany();
    } catch (error) {
      console.error('Error getting awaiting return bookings:', error);
      return [];
    }
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
    pendingBookings: number;
    activeBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    totalRevenue: number;
  }> {
    const [totalResult, pendingResult, activeResult, completedResult, cancelledResult] = await Promise.all([
      this.bookingRepository.query('SELECT COUNT(*) as count FROM bookings'),
      this.bookingRepository.query(`SELECT COUNT(*) as count FROM bookings WHERE LOWER(CAST(status AS TEXT)) = 'pending'`),
      this.bookingRepository.query(`SELECT COUNT(*) as count FROM bookings WHERE LOWER(CAST(status AS TEXT)) = 'active'`),
      this.bookingRepository.query(`SELECT COUNT(*) as count FROM bookings WHERE LOWER(CAST(status AS TEXT)) = 'completed'`),
      this.bookingRepository.query(`SELECT COUNT(*) as count FROM bookings WHERE LOWER(CAST(status AS TEXT)) = 'cancelled'`),
    ]);

    const total = parseInt(totalResult[0]?.count) || 0;
    const pending = parseInt(pendingResult[0]?.count) || 0;
    const active = parseInt(activeResult[0]?.count) || 0;
    const completed = parseInt(completedResult[0]?.count) || 0;
    const cancelled = parseInt(cancelledResult[0]?.count) || 0;

    const revenueResult = await this.bookingRepository.query(
      `SELECT SUM("totalAmount") as "totalRevenue" FROM bookings WHERE LOWER(CAST(status AS TEXT)) = 'completed'`
    );

    return {
      totalBookings: total,
      pendingBookings: pending,
      activeBookings: active,
      completedBookings: completed,
      cancelledBookings: cancelled,
      totalRevenue: parseFloat(revenueResult[0]?.totalRevenue) || 0,
    };
  }

  /**
   * Cancela reservas pendentes sem pagamento após um tempo limite.
   * Isso libera automaticamente as datas do veículo.
   */
  async cancelOverduePendingPaymentBookings(timeoutMinutes = 30): Promise<number> {
    try {
      const timeoutAt = new Date(Date.now() - timeoutMinutes * 60 * 1000);
      const overdueBookings = await this.bookingRepository.query(
        `SELECT id FROM bookings
         WHERE LOWER(CAST(status AS TEXT)) = 'pending'
           AND LOWER(CAST("paymentStatus" AS TEXT)) = 'pending'
           AND "createdAt" <= $1`,
        [timeoutAt],
      );

      let updatedCount = 0;
      for (const row of overdueBookings) {
        await this.bookingRepository.query(
          `UPDATE bookings
             SET status = 'cancelled',
                 "paymentStatus" = 'FAILED',
                 "returnNotes" = COALESCE("returnNotes", 'Reserva cancelada automaticamente por ausência de pagamento no prazo')
           WHERE id = $1`,
          [row.id],
        );
        updatedCount++;
      }

      if (updatedCount > 0) {
        console.log(
          `Canceled ${updatedCount} overdue pending bookings (timeout: ${timeoutMinutes} minutes)`,
        );
      }
      return updatedCount;
    } catch (error) {
      console.error('Error canceling overdue pending bookings:', error);
      return 0;
    }
  }

  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter !== undefined) {
      return this.transporter;
    }

    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const port = Number(this.configService.get<string>('SMTP_PORT') || 587);
    const secureValue = String(this.configService.get<string>('SMTP_SECURE') || '').toLowerCase();
    const secure = secureValue ? secureValue === 'true' : port === 465;

    if (!host || !user || !pass) {
      if (!this.missingSmtpLogged) {
        this.logger.warn('SMTP is not configured. Booking pending approval emails will be skipped.');
        this.missingSmtpLogged = true;
      }
      this.transporter = null;
      return this.transporter;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
    return this.transporter;
  }

  private async sendPendingApprovalEmail(bookingId: string): Promise<void> {
    try {
      const booking = await this.bookingRepository.findOne({
        where: { id: bookingId },
        relations: ['lessee', 'lessor', 'vehicle'],
      });
      if (!booking?.lessor?.email) return;

      const transporter = this.getTransporter();
      if (!transporter) return;

      const from =
        this.configService.get<string>('SMTP_FROM') ||
        this.configService.get<string>('SMTP_USER') ||
        'no-reply@carandgo.com.br';

      const vehicleTitle = `${booking.vehicle?.make || ''} ${booking.vehicle?.model || ''} ${booking.vehicle?.year || ''}`.trim();
      const lesseeName = `${booking.lessee?.firstName || ''} ${booking.lessee?.lastName || ''}`.trim() || 'um locatário';

      await transporter.sendMail({
        from,
        to: booking.lessor.email,
        subject: 'Novo pedido de locação aguardando sua aprovação',
        text: [
          `Olá, ${booking.lessor.firstName || 'locador'}!`,
          '',
          `O veículo ${vehicleTitle} deu entrada no trâmite de locação e está aguardando sua aprovação.`,
          `Locatário: ${lesseeName}.`,
          `Período: ${new Date(booking.startDate).toLocaleDateString('pt-BR')} até ${new Date(booking.endDate).toLocaleDateString('pt-BR')}.`,
          '',
          'Acesse a plataforma CarGo para aprovar ou rejeitar a solicitação.',
        ].join('\n'),
        html: `
          <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
            <p>Olá, ${booking.lessor.firstName || 'locador'}!</p>
            <p>O veículo <strong>${vehicleTitle}</strong> deu entrada no trâmite de locação e está aguardando sua aprovação.</p>
            <p><strong>Locatário:</strong> ${lesseeName}</p>
            <p><strong>Período:</strong> ${new Date(booking.startDate).toLocaleDateString('pt-BR')} até ${new Date(booking.endDate).toLocaleDateString('pt-BR')}</p>
            <p>Acesse a plataforma CarGo para aprovar ou rejeitar a solicitação.</p>
          </div>
        `,
      });
    } catch (error: any) {
      this.logger.error('Failed to send pending approval email to lessor', error?.stack || String(error));
    }
  }

  private async sendReadyToPayEmail(bookingId: string): Promise<void> {
    try {
      const booking = await this.bookingRepository.findOne({
        where: { id: bookingId },
        relations: ['lessee', 'lessor', 'vehicle'],
      });
      if (!booking?.lessee?.email) return;

      const transporter = this.getTransporter();
      if (!transporter) return;

      const from =
        this.configService.get<string>('SMTP_FROM') ||
        this.configService.get<string>('SMTP_USER') ||
        'no-reply@carandgo.com.br';

      const vehicleTitle = `${booking.vehicle?.make || ''} ${booking.vehicle?.model || ''} ${booking.vehicle?.year || ''}`.trim();

      await transporter.sendMail({
        from,
        to: booking.lessee.email,
        subject: 'Sua locação foi aprovada - você já pode pagar',
        text: [
          `Olá, ${booking.lessee.firstName || 'locatário'}!`,
          '',
          `A locação do veículo ${vehicleTitle} foi aprovada pelo locador.`,
          'Agora você já pode realizar o pagamento para concluir a reserva.',
          '',
          `Período: ${new Date(booking.startDate).toLocaleDateString('pt-BR')} até ${new Date(booking.endDate).toLocaleDateString('pt-BR')}.`,
          '',
          'Acesse a plataforma CarGo para finalizar o pagamento.',
        ].join('\n'),
        html: `
          <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
            <p>Olá, ${booking.lessee.firstName || 'locatário'}!</p>
            <p>A locação do veículo <strong>${vehicleTitle}</strong> foi aprovada pelo locador.</p>
            <p>Agora você já pode realizar o pagamento para concluir a reserva.</p>
            <p><strong>Período:</strong> ${new Date(booking.startDate).toLocaleDateString('pt-BR')} até ${new Date(booking.endDate).toLocaleDateString('pt-BR')}</p>
            <p>Acesse a plataforma CarGo para finalizar o pagamento.</p>
          </div>
        `,
      });
    } catch (error: any) {
      this.logger.error('Failed to send ready-to-pay email to lessee', error?.stack || String(error));
    }
  }
}
