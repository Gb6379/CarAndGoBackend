import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  BaseEntity,
} from 'typeorm';
import { Vehicle } from '../../vehicle/entities/vehicle.entity';
import { User } from '../../user/entities/user.entity';
import { DeviceStatus } from '../enums/device-status.enum';

@Entity('locator_devices')
export class LocatorDevice extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  deviceId: string; // Hardware device identifier

  @Column({ unique: true })
  imei: string; // IMEI number for tracking

  @Column({ type: 'enum', enum: DeviceStatus, default: DeviceStatus.INACTIVE })
  status: DeviceStatus;

  @Column({ nullable: true })
  model: string;

  @Column({ nullable: true })
  manufacturer: string;

  @Column({ nullable: true })
  firmwareVersion: string;

  @Column({ default: 100 })
  batteryLevel: number; // Battery percentage

  @Column({ default: false })
  isOnline: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastSeen: Date;

  // Installation Information
  @Column({ type: 'timestamp', nullable: true })
  installationDate: Date;

  @Column({ nullable: true })
  installationLocation: string; // Where in the vehicle it's installed

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  installationLatitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  installationLongitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number;

  @Column({ nullable: true })
  installerName: string;

  @Column({ nullable: true })
  installerLicense: string;

  // Technical Details
  @Column({ default: false })
  gpsEnabled: boolean;

  @Column({ default: false })
  gsmEnabled: boolean;

  @Column({ default: false })
  wifiEnabled: boolean;

  @Column({ default: false })
  bluetoothEnabled: boolean;

  @Column({ nullable: true })
  simCardNumber: string;

  @Column({ nullable: true })
  simCardProvider: string;

  // Configuration
  @Column({ default: 300 })
  trackingInterval: number; // Seconds between location updates

  @Column({ default: true })
  realTimeTracking: boolean;

  @Column({ default: true })
  geofencingEnabled: boolean;

  @Column({ default: false })
  speedAlertEnabled: boolean;

  @Column({ default: 120 })
  maxSpeedAlert: number; // km/h

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Vehicle, (vehicle) => vehicle.locatorDevice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  @Column({ nullable: true })
  vehicleId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'installerId' })
  installer: User;

  @Column({ nullable: true })
  installerId: string;
}
