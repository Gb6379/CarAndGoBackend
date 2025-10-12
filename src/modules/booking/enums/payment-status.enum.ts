export enum PaymentStatus {
  PENDING = 'pending', // Payment pending
  PROCESSING = 'processing', // Payment being processed
  COMPLETED = 'completed', // Payment completed
  FAILED = 'failed', // Payment failed
  REFUNDED = 'refunded', // Payment refunded
  PARTIAL_REFUND = 'partial_refund', // Partial refund
  CANCELLED = 'cancelled', // Payment cancelled
}
