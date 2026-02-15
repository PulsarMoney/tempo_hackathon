import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';
import {
  PoolEntity,
  PoolEventEntity,
  PoolParticipantEntity,
  PoolPayoutEntity,
} from '../db/entities';
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
      PoolPayoutEntity,
      PoolEventEntity,
    ]),
  ],
  providers: [PayoutsService, RolesGuard],
  controllers: [PayoutsController],
})
export class PayoutsModule {}
