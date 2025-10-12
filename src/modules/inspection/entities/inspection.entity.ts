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
import { InspectionStatus } from '../enums/inspection-status.enum';

@Entity('inspections')
export class Inspection extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: InspectionStatus, default: InspectionStatus.PENDING })
  status: InspectionStatus;

  @Column({ type: 'timestamp' })
  scheduledDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  actualDate: Date;

  @Column({ nullable: true })
  location: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number;

  // Inspection Results
  @Column({ default: false })
  exteriorPassed: boolean;

  @Column({ default: false })
  interiorPassed: boolean;

  @Column({ default: false })
  mechanicalPassed: boolean;

  @Column({ default: false })
  documentsPassed: boolean;

  @Column({ default: false })
  safetyPassed: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  overallScore: number;

  @Column({ nullable: true })
  notes: string;

  @Column('text', { array: true, default: [] })
  photos: string[];

  @Column({ nullable: true })
  inspectionReport: string; // PDF or document URL

  // Inspector Information
  @Column({ nullable: true })
  inspectorName: string;

  @Column({ nullable: true })
  inspectorLicense: string;

  @Column({ nullable: true })
  inspectorSignature: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Vehicle, (vehicle) => vehicle.inspections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  @Column()
  vehicleId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inspectorId' })
  inspector: User;

  @Column({ nullable: true })
  inspectorId: string;
}
