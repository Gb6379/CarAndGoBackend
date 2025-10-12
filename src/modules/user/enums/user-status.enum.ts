export enum UserStatus {
  PENDING = 'pending', // Awaiting document verification
  VERIFIED = 'verified', // Documents verified and approved
  REJECTED = 'rejected', // Documents rejected
  SUSPENDED = 'suspended', // Account suspended
  ACTIVE = 'active', // Fully active user
}
