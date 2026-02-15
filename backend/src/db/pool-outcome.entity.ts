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

@Entity('pool_outcomes')
export class PoolOutcomeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'pool_id', type: 'uuid' })
  poolId!: string;

  @Column({ name: 'outcome_json', type: 'jsonb' })
  outcomeJson!: Record<string, unknown>;

  @Index()
  @Column({ name: 'resolved_by_user_id', type: 'uuid' })
  resolvedByUserId!: string;

  @Column({ name: 'resolve_note', type: 'text' })
  resolveNote!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => PoolEntity, (pool) => pool.outcomes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pool_id' })
  pool!: PoolEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'resolved_by_user_id' })
  resolver!: UserEntity;
}
