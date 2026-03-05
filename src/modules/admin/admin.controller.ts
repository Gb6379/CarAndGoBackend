import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UserService } from '../user/user.service';
import { BookingService } from '../booking/booking.service';
import { UserType } from '../user/enums/user-type.enum';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly userService: UserService,
    private readonly bookingService: BookingService,
  ) {}

  /** Dashboard: indicadores gerais */
  @Get('dashboard')
  async getDashboard() {
    const [bookingStats, userStats] = await Promise.all([
      this.bookingService.getBookingStats(),
      this.userService.getStats(),
    ]);
    return {
      bookings: bookingStats,
      users: userStats,
    };
  }

  /** Listar usuários (locadores e locatários) com filtro opcional */
  @Get('users')
  async getUsers(@Query('userType') userType?: string) {
    if (userType === 'lessor' || userType === 'lessee' || userType === 'both') {
      return this.userService.findByUserType(userType as UserType);
    }
    return this.userService.findAll();
  }

  /** Atualizar status de um usuário (active, inactive, suspended, pending) */
  @Patch('users/:id/status')
  async updateUserStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.userService.updateStatus(id, status);
  }

  /** Documento CNH de um usuário (para verificação pelo admin) */
  @Get('users/:id/documents/cnh')
  async getUserCnh(@Param('id') id: string, @Res() res: Response) {
    const doc = await this.userService.getCnhDocument(id);
    if (!doc) throw new NotFoundException('CNH não enviada por este usuário.');
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Cache-Control', 'no-store');
    res.send(doc.data);
  }

  /** Documento CAC de um usuário (para verificação pelo admin) */
  @Get('users/:id/documents/cac')
  async getUserCac(@Param('id') id: string, @Res() res: Response) {
    const doc = await this.userService.getCacDocument(id);
    if (!doc) throw new NotFoundException('CAC não enviada por este usuário.');
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Cache-Control', 'no-store');
    res.send(doc.data);
  }

  /** Listar todas as reservas */
  @Get('bookings')
  async getBookings() {
    return this.bookingService.findAll();
  }

  /** Aprovar reserva (confirmar) */
  @Post('bookings/:id/approve')
  async approveBooking(@Param('id') id: string) {
    return this.bookingService.confirmBooking(id);
  }

  /** Cancelar reserva */
  @Post('bookings/:id/cancel')
  async cancelBooking(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.bookingService.cancelBooking(id, reason || 'Cancelado pelo administrador');
  }

  /** Rejeitar reserva (apenas pendentes) */
  @Post('bookings/:id/reject')
  async rejectBooking(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.bookingService.rejectBooking(id, reason);
  }
}
