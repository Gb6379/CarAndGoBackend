export enum BookingStatus {
  PENDING = 'pending', // Awaiting confirmation from lessor
  CONFIRMED = 'confirmed', // Confirmed by lessor, waiting for trip start
  ACTIVE = 'active', // Trip in progress
  AWAITING_RETURN = 'awaiting_return', // End date reached, waiting for lessor to confirm return
  COMPLETED = 'completed', // Trip completed, vehicle returned
  CANCELLED = 'cancelled', // Cancelled by user
  REJECTED = 'rejected', // Rejected by lessor
  EXPIRED = 'expired', // Expired without confirmation
}
