import { UserEntity } from './user.entity';
import { UserAccountEntity } from './user-account.entity';
import { UserRoleEntity } from './user-role.entity';
import { PoolEntity } from './pool.entity';
import type { PoolStatus } from './pool.entity';
import { PoolParticipantEntity } from './pool-participant.entity';
import { PoolOutcomeEntity } from './pool-outcome.entity';
import { PoolPayoutEntity } from './pool-payout.entity';
import { PoolEventEntity } from './pool-event.entity';
import { PoolScoreEntity } from './pool-score.entity';

export const dbEntities = [
  UserEntity,
  UserAccountEntity,
  UserRoleEntity,
  PoolEntity,
  PoolParticipantEntity,
  PoolOutcomeEntity,
  PoolPayoutEntity,
  PoolEventEntity,
  PoolScoreEntity,
];

export {
  UserEntity,
  UserAccountEntity,
  UserRoleEntity,
  PoolEntity,
  PoolParticipantEntity,
  PoolOutcomeEntity,
  PoolPayoutEntity,
  PoolEventEntity,
  PoolScoreEntity,
};

export type { PoolStatus };
