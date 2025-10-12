import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  BaseEntity,
} from 'typeorm';
import { Vehicle } from '../../vehicle/entities/vehicle.entity';
import { Booking } from '../../booking/entities/booking.entity';
import { UserType } from '../enums/user-type.enum';
import { UserStatus } from '../enums/user-status.enum';

@Entity('users')
export class User extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  cpfCnpj: string;

  @Column({ type: 'enum', enum: UserType })
  userType: UserType;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.PENDING })
  status: UserStatus;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'date', nullable: true })
  birthDate: Date;

  // Address Information
  @Column({ nullable: true })
  street: string;

  @Column({ nullable: true })
  number: string;

  @Column({ nullable: true })
  complement: string;

  @Column({ nullable: true })
  neighborhood: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  zipCode: string;

  // Document Verification
  @Column({ default: false })
  documentsVerified: boolean;

  @Column({ nullable: true })
  govBrId: string;

  @Column({ nullable: true })
  creditScore: number;

  @Column({ default: false })
  criminalBackgroundCheck: boolean;

  // Profile Photo
  @Column({ nullable: true })
  profilePhoto: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => Vehicle, (vehicle) => vehicle.owner)
  vehicles: Vehicle[];

  @OneToMany(() => Booking, (booking) => booking.lessee)
  bookings: Booking[];

  @OneToMany(() => Booking, (booking) => booking.lessor)
  lessorBookings: Booking[];
}
