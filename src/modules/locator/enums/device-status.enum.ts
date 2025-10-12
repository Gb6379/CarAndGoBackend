export enum DeviceStatus {
  INACTIVE = 'inactive', // Device not yet activated
  ACTIVE = 'active', // Device active and tracking
  INSTALLED = 'installed', // Device installed in vehicle
  MAINTENANCE = 'maintenance', // Device under maintenance
  FAULTY = 'faulty', // Device has issues
  REPLACED = 'replaced', // Device has been replaced
}
