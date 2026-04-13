import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UserService } from '../user/user.service';
import { BookingService } from '../booking/booking.service';
import { UserType } from '../user/enums/user-type.enum';
import { AdminEmailService } from './admin-email.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly userService: UserService,
    private readonly bookingService: BookingService,
    private readonly adminEmailService: AdminEmailService,
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

  /** Listar usuários com filtro opcional por tipo e status */
  @Get('users')
  async getUsers(@Query('userType') userType?: string, @Query('status') status?: string) {
    const normalizedUserType =
      userType === 'lessor' || userType === 'lessee' || userType === 'both'
        ? (userType as UserType)
        : undefined;

    return this.userService.findForAdmin({
      userType: normalizedUserType,
      status,
    });
  }

  /** Atualizar status de um usuário (active, inactive, suspended, pending) */
  @Patch('users/:id/status')
  async updateUserStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.userService.updateStatus(id, status);
  }

  /** Aprovar documentos e ativar usuário */
  @Post('users/:id/approve-documents')
  async approveUserDocuments(@Param('id') id: string) {
    const user = await this.userService.approveDocuments(id);
    const emailSent = await this.adminEmailService.sendDocumentsApprovedEmail(user);
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      userType: user.userType,
      status: user.status,
      documentsVerified: user.documentsVerified,
      emailSent,
      createdAt: user.createdAt,
    };
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
