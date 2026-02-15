import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { PoolParticipantEntity } from './pool-participant.entity';
import { PoolOutcomeEntity } from './pool-outcome.entity';
import { PoolPayoutEntity } from './pool-payout.entity';
import { PoolEventEntity } from './pool-event.entity';

export type PoolStatus = 'open' | 'closed' | 'resolved' | 'paid';

@Entity('pools')
export class PoolEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  title!: string;

  @Index()
  @Column({ name: 'creator_user_id', type: 'uuid' })
  creatorUserId!: string;

  @Column({ name: 'entry_amount', type: 'numeric', precision: 30, scale: 8 })
  entryAmount!: string;

  @Column({ name: 'token_address', type: 'text' })
  tokenAddress!: string;

  @Column({ type: 'text', default: 'open' })
  status!: PoolStatus;

  @Column({ name: 'close_at', type: 'timestamptz' })
  closeAt!: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => UserEntity, (user) => user.createdPools, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'creator_user_id' })
  creator!: UserEntity;

  @OneToMany(() => PoolParticipantEntity, (participant) => participant.pool)
  participants!: PoolParticipantEntity[];

  @OneToMany(() => PoolOutcomeEntity, (outcome) => outcome.pool)
  outcomes!: PoolOutcomeEntity[];

  @OneToMany(() => PoolPayoutEntity, (payout) => payout.pool)
  payouts!: PoolPayoutEntity[];

  @OneToMany(() => PoolEventEntity, (event) => event.pool)
  events!: PoolEventEntity[];
}
