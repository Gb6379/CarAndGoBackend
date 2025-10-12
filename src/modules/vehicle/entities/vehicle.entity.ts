import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  BaseEntity,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Booking } from '../../booking/entities/booking.entity';
import { Inspection } from '../../inspection/entities/inspection.entity';
import { LocatorDevice } from '../../locator/entities/locator-device.entity';
import { VehicleStatus } from '../enums/vehicle-status.enum';
import { VehicleType } from '../enums/vehicle-type.enum';
import { FuelType } from '../enums/fuel-type.enum';

@Entity('vehicles')
export class Vehicle extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  make: string; // Marca

  @Column()
  model: string; // Modelo

  @Column()
  year: number; // Ano

  @Column()
  licensePlate: string; // Placa

  @Column({ type: 'enum', enum: VehicleType })
  type: VehicleType;

  @Column({ type: 'enum', enum: FuelType })
  fuelType: FuelType;

  @Column()
  engineCapacity: number; // Cilindrada

  @Column()
  mileage: number; // Quilometragem

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  dailyRate: number; // Taxa diária

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  hourlyRate: number; // Taxa por hora

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  securityDeposit: number; // Caução

  @Column({ type: 'enum', enum: VehicleStatus, default: VehicleStatus.PENDING })
  status: VehicleStatus;

  @Column({ default: 0 })
  totalBookings: number; // Total de locações

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  rating: number; // Avaliação média

  // Location Information
  @Column()
  address: string;

  @Column()
  city: string;

  @Column()
  state: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number;

  // Vehicle Details
  @Column({ nullable: true })
  color: string;

  @Column({ nullable: true })
  transmission: string; // Manual, Automático

  @Column({ default: 0 })
  seats: number;

  @Column({ default: false })
  airConditioning: boolean;

  @Column({ default: false })
  gps: boolean;

  @Column({ default: false })
  bluetooth: boolean;

  @Column({ default: false })
  usbCharger: boolean;

  // Locator Integration
  @Column({ nullable: true })
  locatorDeviceId: string;

  @Column({ default: false })
  locatorInstalled: boolean;

  @Column({ default: false })
  locatorIntegrated: boolean;

  // Inspection
  @Column({ default: false })
  inspectionPassed: boolean;

  @Column({ nullable: true })
  inspectionDate: Date;

  @Column({ nullable: true })
  inspectorId: string;

  // Documents
  @Column({ nullable: true })
  registrationDocument: string; // Documento de registro

  @Column({ nullable: true })
  insuranceDocument: string; // Documento de seguro

  @Column({ nullable: true })
  inspectionDocument: string; // Documento de vistoria

  // Photos
  @Column('text', { array: true, default: [] })
  photos: string[];

  @Column({ nullable: true })
  thumbnail: string; // Foto principal

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.vehicles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column()
  ownerId: string;

  @OneToMany(() => Booking, (booking) => booking.vehicle)
  bookings: Booking[];

  @OneToMany(() => Inspection, (inspection) => inspection.vehicle)
  inspections: Inspection[];

  @OneToMany(() => LocatorDevice, (device) => device.vehicle)
  locatorDevice: LocatorDevice[];
}
