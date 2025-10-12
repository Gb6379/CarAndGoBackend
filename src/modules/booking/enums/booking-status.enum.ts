export enum BookingStatus {
  PENDING = 'pending', // Awaiting confirmation
  CONFIRMED = 'confirmed', // Confirmed by lessor
  ACTIVE = 'active', // Trip in progress
  COMPLETED = 'completed', // Trip completed successfully
  CANCELLED = 'cancelled', // Cancelled by user
  REJECTED = 'rejected', // Rejected by lessor
  EXPIRED = 'expired', // Expired without confirmation
}
