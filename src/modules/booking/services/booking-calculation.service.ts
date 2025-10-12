import { Injectable } from '@nestjs/common';

export interface BookingCalculationInput {
  startDate: Date;
  endDate: Date;
  dailyRate: number;
  hourlyRate: number;
  securityDeposit: number;
  distance?: number; // in kilometers
  isEarlyReturn?: boolean;
  earlyReturnDate?: Date;
}

export interface BookingCalculationResult {
  totalDays: number;
  totalHours: number;
  baseAmount: number;
  distanceFee: number;
  platformFee: number;
  lessorAmount: number;
  totalAmount: number;
  securityDeposit: number;
  earlyReturnDiscount?: number;
}

@Injectable()
export class BookingCalculationService {
  private readonly PLATFORM_FEE_PERCENTAGE = 0.30; // 30% for platform, 70% for lessor
  private readonly DISTANCE_FEE_PER_KM = 0.50; // R$ 0.50 per km
  private readonly EARLY_RETURN_DISCOUNT_PERCENTAGE = 0.15; // 15% discount for early return

  calculateBookingCost(input: BookingCalculationInput): BookingCalculationResult {
    const { startDate, endDate, dailyRate, hourlyRate, securityDeposit, distance, isEarlyReturn, earlyReturnDate } = input;

    // Calculate time duration
    const actualEndDate = isEarlyReturn && earlyReturnDate ? earlyReturnDate : endDate;
    const durationMs = actualEndDate.getTime() - startDate.getTime();
    const totalHours = Math.ceil(durationMs / (1000 * 60 * 60));
    const totalDays = Math.ceil(totalHours / 24);

    // Calculate base amount (daily rate takes precedence)
    const baseAmount = totalDays > 1 ? 
      totalDays * dailyRate : 
      totalHours * hourlyRate;

    // Calculate distance fee
    const distanceFee = distance ? distance * this.DISTANCE_FEE_PER_KM : 0;

    // Calculate early return discount
    let earlyReturnDiscount = 0;
    if (isEarlyReturn && earlyReturnDate) {
      const originalDurationMs = endDate.getTime() - startDate.getTime();
      const actualDurationMs = earlyReturnDate.getTime() - startDate.getTime();
      const unusedTimeMs = originalDurationMs - actualDurationMs;
      const unusedDays = unusedTimeMs / (1000 * 60 * 60 * 24);
      
      if (unusedDays > 1) {
        earlyReturnDiscount = unusedDays * dailyRate * this.EARLY_RETURN_DISCOUNT_PERCENTAGE;
      }
    }

    // Calculate total amount before platform fee
    const subtotalAmount = baseAmount + distanceFee - earlyReturnDiscount;

    // Calculate platform fee (30% of subtotal)
    const platformFee = subtotalAmount * this.PLATFORM_FEE_PERCENTAGE;

    // Calculate lessor amount (70% of subtotal)
    const lessorAmount = subtotalAmount - platformFee;

    // Calculate total amount (including security deposit)
    const totalAmount = subtotalAmount + securityDeposit;

    return {
      totalDays,
      totalHours,
      baseAmount,
      distanceFee,
      platformFee,
      lessorAmount,
      totalAmount,
      securityDeposit,
      earlyReturnDiscount: earlyReturnDiscount > 0 ? earlyReturnDiscount : undefined,
    };
  }

  calculateHourlyRate(dailyRate: number): number {
    // Hourly rate is typically 1/8 of daily rate (assuming 8 hours per day)
    return dailyRate / 8;
  }

  calculateSecurityDeposit(dailyRate: number, totalDays: number): number {
    // Security deposit is typically 2x the daily rate, with a minimum of R$ 100
    return Math.max(dailyRate * 2, 100);
  }

  validateBookingDates(startDate: Date, endDate: Date): { isValid: boolean; error?: string } {
    const now = new Date();
    const minStartDate = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now

    if (startDate < minStartDate) {
      return {
        isValid: false,
        error: 'Booking must start at least 2 hours from now'
      };
    }

    if (endDate <= startDate) {
      return {
        isValid: false,
        error: 'End date must be after start date'
      };
    }

    const maxDuration = 30 * 24 * 60 * 60 * 1000; // 30 days
    if (endDate.getTime() - startDate.getTime() > maxDuration) {
      return {
        isValid: false,
        error: 'Maximum booking duration is 30 days'
      };
    }

    return { isValid: true };
  }
}
