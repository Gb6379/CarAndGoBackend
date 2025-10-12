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
import { Vehicle } from '../../vehicle/entities/vehicle.entity';
import { BookingStatus } from '../enums/booking-status.enum';
import { PaymentStatus } from '../enums/payment-status.enum';

@Entity('bookings')
export class Booking extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status: BookingStatus;

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp' })
  endDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  actualStartDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  actualEndDate: Date;

  // Pricing
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  dailyRate: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  hourlyRate: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  platformFee: number; // 30% for lessor, 70% for platform

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  lessorAmount: number; // Amount for lessor

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  securityDeposit: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  additionalFees: number;

  // Route Information
  @Column({ nullable: true })
  originCity: string;

  @Column({ nullable: true })
  destinationCity: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  originLatitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  originLongitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  destinationLatitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  destinationLongitude: number;

  @Column({ nullable: true })
  scheduledRoute: string; // JSON string of route points

  @Column({ default: 0 })
  plannedDistance: number; // Planned distance in KM

  @Column({ default: 0 })
  actualDistance: number; // Actual distance traveled in KM

  // Vehicle Condition
  @Column({ default: 0 })
  startMileage: number;

  @Column({ default: 0 })
  endMileage: number;

  @Column({ nullable: true })
  startPhotos: string; // JSON string of photo URLs

  @Column({ nullable: true })
  endPhotos: string; // JSON string of photo URLs

  @Column({ nullable: true })
  vehicleCondition: string; // JSON string of condition notes

  // Payment Information
  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  paymentStatus: PaymentStatus;

  @Column({ nullable: true })
  paymentTransactionId: string;

  @Column({ nullable: true })
  paymentMethod: string;

  @Column({ type: 'timestamp', nullable: true })
  paymentDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  refundDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  refundAmount: number;

  // Communication
  @Column({ nullable: true })
  videoChatId: string;

  @Column({ type: 'timestamp', nullable: true })
  videoChatStartTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  videoChatEndTime: Date;

  // Checkout Process
  @Column({ default: false })
  checkoutCompleted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  checkoutTime: Date;

  @Column({ nullable: true })
  checkoutNotes: string;

  @Column({ default: false })
  returnCompleted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  returnTime: Date;

  @Column({ nullable: true })
  returnNotes: string;

  // Early Return
  @Column({ default: false })
  earlyReturn: boolean;

  @Column({ type: 'timestamp', nullable: true })
  earlyReturnDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  earlyReturnDiscount: number;

  // Ratings and Reviews
  @Column({ type: 'int', nullable: true })
  lesseeRating: number; // Rating given by lessee to lessor/vehicle

  @Column({ type: 'int', nullable: true })
  lessorRating: number; // Rating given by lessor to lessee

  @Column({ nullable: true })
  lesseeReview: string;

  @Column({ nullable: true })
  lessorReview: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.bookings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesseeId' })
  lessee: User;

  @Column()
  lesseeId: string;

  @ManyToOne(() => User, (user) => user.lessorBookings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lessorId' })
  lessor: User;

  @Column()
  lessorId: string;

  @ManyToOne(() => Vehicle, (vehicle) => vehicle.bookings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  @Column()
  vehicleId: string;
}
