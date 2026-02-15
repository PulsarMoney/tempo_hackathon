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
import { PoolParticipantEntity } from './pool-participant.entity';

export type PayoutStatus = 'pending' | 'confirmed' | 'failed';

@Entity('pool_payouts')
@Unique(['poolId', 'participantId'])
export class PoolPayoutEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'pool_id', type: 'uuid' })
  poolId!: string;

  @Index()
  @Column({ name: 'participant_id', type: 'uuid' })
  participantId!: string;

  @Index()
  @Column({ name: 'execution_id', type: 'uuid' })
  executionId!: string;

  @Column({ type: 'numeric', precision: 30, scale: 8 })
  amount!: string;

  @Column({ name: 'memo_hex', type: 'text' })
  memoHex!: string;

  @Column({ name: 'memo_reference', type: 'text' })
  memoReference!: string;

  @Column({ name: 'tx_hash', type: 'text', nullable: true })
  txHash!: string | null;

  @Column({ type: 'text', default: 'pending' })
  status!: PayoutStatus;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => PoolEntity, (pool) => pool.payouts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pool_id' })
  pool!: PoolEntity;

  @ManyToOne(() => PoolParticipantEntity, (participant) => participant.payouts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participant_id' })
  participant!: PoolParticipantEntity;
}
