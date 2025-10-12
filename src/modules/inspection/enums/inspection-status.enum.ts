export enum InspectionStatus {
  PENDING = 'pending', // Inspection scheduled but not started
  IN_PROGRESS = 'in_progress', // Inspection currently being conducted
  PASSED = 'passed', // Inspection passed successfully
  FAILED = 'failed', // Inspection failed
  RESCHEDULED = 'rescheduled', // Inspection needs to be rescheduled
  CANCELLED = 'cancelled', // Inspection cancelled
}
