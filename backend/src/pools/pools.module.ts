import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  PoolEntity,
  PoolEventEntity,
  PoolOutcomeEntity,
  PoolParticipantEntity,
  PoolPayoutEntity,
  UserEntity,
} from '../db/entities';
import { PoolsService } from './pools.service';
import { PoolsController } from './pools.controller';
import { AuthModule } from '../auth/auth.module';
import { ChainModule } from '../chain/chain.module';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [
    AuthModule,
    ChainModule,
    TypeOrmModule.forFeature([
      PoolEntity,
      PoolParticipantEntity,
      PoolOutcomeEntity,
      PoolPayoutEntity,
      PoolEventEntity,
      UserEntity,
    ]),
  ],
  providers: [PoolsService, RolesGuard],
  controllers: [PoolsController],
  exports: [PoolsService],
})
export class PoolsModule {}
