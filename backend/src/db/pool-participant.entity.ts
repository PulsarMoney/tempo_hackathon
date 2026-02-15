import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { PoolEntity } from './pool.entity';
import { UserEntity } from './user.entity';
import { PoolPayoutEntity } from './pool-payout.entity';

export type JoinStatus = 'invited' | 'joined' | 'rejected';

@Entity('pool_participants')
@Unique(['poolId', 'userId'])
export class PoolParticipantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'pool_id', type: 'uuid' })
  poolId!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ name: 'wallet_address', type: 'text', nullable: true })
  walletAddress!: string | null;

  @Column({ name: 'join_status', type: 'text', default: 'invited' })
  joinStatus!: JoinStatus;

  @Column({ name: 'join_tx_hash', type: 'text', nullable: true })
  joinTxHash!: string | null;

  @Column({ name: 'join_memo_hex', type: 'text', nullable: true })
  joinMemoHex!: string | null;

  @Column({ name: 'join_reference', type: 'text', nullable: true })
  joinReference!: string | null;

  @Column({ name: 'joined_at', type: 'timestamptz', nullable: true })
  joinedAt!: Date | null;

  @ManyToOne(() => PoolEntity, (pool) => pool.participants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pool_id' })
  pool!: PoolEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity | null;

  @OneToMany(() => PoolPayoutEntity, (payout) => payout.participant)
  payouts!: PoolPayoutEntity[];
}
