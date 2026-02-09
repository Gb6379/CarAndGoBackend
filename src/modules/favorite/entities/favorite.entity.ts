import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  BaseEntity,
  Unique,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Vehicle } from '../../vehicle/entities/vehicle.entity';

@Entity('favorites')
@Unique(['userId', 'vehicleId'])
export class Favorite extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Vehicle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  @Column()
  vehicleId: string;

  @CreateDateColumn()
  createdAt: Date;
}
