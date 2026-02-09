import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createBookingDto: CreateBookingDto) {
    return this.bookingService.create(createBookingDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.bookingService.findAll();
  }

  // Check vehicle availability for given dates (public endpoint)
  @Get('availability/:vehicleId')
  async checkAvailability(
    @Param('vehicleId') vehicleId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const isAvailable = await this.bookingService.checkVehicleAvailability(
      vehicleId,
      new Date(startDate),
      new Date(endDate),
    );
    return { available: isAvailable };
  }

  // Get blocked dates for a vehicle (public endpoint)
  @Get('blocked-dates/:vehicleId')
  async getBlockedDates(@Param('vehicleId') vehicleId: string) {
    const blockedDates = await this.bookingService.getVehicleBlockedDates(vehicleId);
    return { blockedDates };
  }

  // Get pending bookings for a lessor
  @Get('lessor/:lessorId/pending')
  @UseGuards(JwtAuthGuard)
  async getPendingForLessor(@Param('lessorId') lessorId: string) {
    return this.bookingService.getPendingBookingsForLessor(lessorId);
  }

  // Get bookings awaiting return for a lessor
  @Get('lessor/:lessorId/awaiting-return')
  @UseGuards(JwtAuthGuard)
  async getAwaitingReturnForLessor(@Param('lessorId') lessorId: string) {
    return this.bookingService.getAwaitingReturnForLessor(lessorId);
  }

  // Lessor confirms a booking
  @Post(':id/confirm')
  @UseGuards(JwtAuthGuard)
  async confirmBooking(@Param('id') id: string) {
    return this.bookingService.confirmBooking(id);
  }

  // Lessor rejects a booking
  @Post(':id/reject')
  @UseGuards(JwtAuthGuard)
  async rejectBooking(
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.bookingService.rejectBooking(id, reason);
  }

  // Lessor confirms vehicle return (marks booking as completed)
  @Post(':id/confirm-return')
  @UseGuards(JwtAuthGuard)
  async confirmReturn(
    @Param('id') id: string,
    @Body('notes') notes?: string,
  ) {
    return this.bookingService.confirmReturn(id, notes);
  }

  // User cancels a booking
  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancelBooking(
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.bookingService.cancelBooking(id, reason || 'Cancelado pelo usuário');
  }

  // Manually trigger check for bookings that need status update (can be called by cron job)
  @Post('check-awaiting-return')
  async checkAwaitingReturn() {
    const count = await this.bookingService.checkAndUpdateAwaitingReturn();
    return { message: `Updated ${count} bookings to awaiting_return status` };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.bookingService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() updateBookingDto: UpdateBookingDto) {
    return this.bookingService.update(id, updateBookingDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.bookingService.remove(id);
  }
}
