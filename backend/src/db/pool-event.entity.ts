import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PoolEntity } from './pool.entity';
import { UserEntity } from './user.entity';

@Entity('pool_events')
export class PoolEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'pool_id', type: 'uuid' })
  poolId!: string;

  @Column({ name: 'event_type', type: 'text' })
  eventType!: string;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId!: string | null;

  @Column({ name: 'payload_json', type: 'jsonb', default: {} })
  payloadJson!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => PoolEntity, (pool) => pool.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pool_id' })
  pool!: PoolEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_user_id' })
  actor!: UserEntity | null;
}
