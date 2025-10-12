export enum VehicleStatus {
  PENDING = 'pending', // Awaiting inspection
  ACTIVE = 'active', // Available for rent
  INACTIVE = 'inactive', // Not available
  INSPECTION_FAILED = 'inspection_failed', // Failed inspection
  MAINTENANCE = 'maintenance', // Under maintenance
  RENTED = 'rented', // Currently rented
}
