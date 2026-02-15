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

@Entity('pool_trade_events')
@Unique(['poolId', 'betId'])
export class PoolTradeEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'pool_id', type: 'uuid' })
  poolId!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'bet_id', type: 'text' })
  betId!: string;

  @Column({ name: 'stake', type: 'numeric', precision: 30, scale: 8 })
  stake!: string;

  @Column({ name: 'payout', type: 'numeric', precision: 30, scale: 8 })
  payout!: string;

  @Column({ name: 'status', type: 'text' })
  status!: 'won' | 'lost';

  @Column({ name: 'resolved_at_tick', type: 'int' })
  resolvedAtTick!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => PoolEntity, (pool) => pool.tradeEvents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pool_id' })
  pool!: PoolEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;
}

