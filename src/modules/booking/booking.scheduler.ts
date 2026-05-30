import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingService } from './booking.service';

@Injectable()
export class BookingScheduler {
  private readonly logger = new Logger(BookingScheduler.name);

  constructor(private readonly bookingService: BookingService) {}

  // Run every hour to check for bookings that need status update
  @Cron(CronExpression.EVERY_HOUR)
  async handleAwaitingReturnCheck() {
    this.logger.log('Checking for bookings that reached end date...');
    try {
      const updatedCount = await this.bookingService.checkAndUpdateAwaitingReturn();
      if (updatedCount > 0) {
        this.logger.log(`Updated ${updatedCount} bookings to AWAITING_RETURN status`);
      }
    } catch (error) {
      this.logger.error('Error checking awaiting return bookings:', error);
    }
  }

  // Run every 10 minutes to cancel pending bookings without payment
  @Cron('0 */10 * * * *')
  async handlePendingPaymentTimeout() {
    this.logger.log('Checking overdue pending bookings without payment...');
    try {
      const cancelledCount =
        await this.bookingService.cancelOverduePendingPaymentBookings(30);
      if (cancelledCount > 0) {
        this.logger.log(
          `Cancelled ${cancelledCount} overdue pending bookings and released dates`,
        );
      }
    } catch (error) {
      this.logger.error('Error canceling overdue pending bookings:', error);
    }
  }

  // Also run at startup (after 10 seconds delay)
  @Cron('10 * * * * *', { name: 'startup-check' })
  async handleStartupCheck() {
    // Only run once at startup
    this.logger.log('Running startup check for awaiting return bookings...');
    try {
      const updatedCount = await this.bookingService.checkAndUpdateAwaitingReturn();
      if (updatedCount > 0) {
        this.logger.log(`Startup: Updated ${updatedCount} bookings to AWAITING_RETURN status`);
      }
    } catch (error) {
      this.logger.error('Startup check error:', error);
    }
  }
}
