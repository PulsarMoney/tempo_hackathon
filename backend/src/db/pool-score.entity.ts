import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { PoolEntity } from './pool.entity';
import { UserEntity } from './user.entity';

@Entity('pool_scores')
@Unique(['poolId', 'userId'])
export class PoolScoreEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'pool_id', type: 'uuid' })
  poolId!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'numeric', precision: 30, scale: 8 })
  pnl!: string;

  @Column({ name: 'total_stake', type: 'numeric', precision: 30, scale: 8 })
  totalStake!: string;

  @Column({ name: 'total_payout', type: 'numeric', precision: 30, scale: 8 })
  totalPayout!: string;

  @Column({ type: 'integer', default: 0 })
  wins!: number;

  @Column({ type: 'integer', default: 0 })
  losses!: number;

  @CreateDateColumn({ name: 'submitted_at' })
  submittedAt!: Date;

  @ManyToOne(() => PoolEntity, (pool) => pool.scores, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pool_id' })
  pool!: PoolEntity;

  @ManyToOne(() => UserEntity, (user) => user.poolScores, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;
}
