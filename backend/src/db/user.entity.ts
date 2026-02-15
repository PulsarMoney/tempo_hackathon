import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { UserAccountEntity } from './user-account.entity';
import { UserRoleEntity } from './user-role.entity';
import { PoolEntity } from './pool.entity';

@Entity('users')
@Unique(['privyDid'])
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'privy_did', type: 'text' })
  privyDid!: string;

  @Column({ name: 'primary_wallet', type: 'text', nullable: true })
  primaryWallet!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => UserAccountEntity, (account) => account.user)
  accounts!: UserAccountEntity[];

  @OneToMany(() => UserRoleEntity, (role) => role.user)
  roles!: UserRoleEntity[];

  @OneToMany(() => PoolEntity, (pool) => pool.creator)
  createdPools!: PoolEntity[];
}
