import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PoolsService } from './pools.service';
import { CreatePoolDto, JoinPoolDto, ResolvePoolDto, SubmitPoolTradesDto } from './dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user';

@Controller('pools')
@UseGuards(AuthGuard)
export class PoolsController {
  constructor(private readonly poolsService: PoolsService) {}

  @Post()
  async createPool(@CurrentUser() currentUser: AuthenticatedUser, @Body() body: CreatePoolDto) {
    return this.poolsService.createPool(currentUser, body);
  }

  @Get()
  async listMyPools(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.poolsService.listMyPools(currentUser);
  }

  @Get(':poolId')
  async getPool(@Param('poolId') poolId: string, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.poolsService.getPool(poolId, currentUser);
  }

  @Post(':poolId/join-intent')
  async createJoinIntent(@Param('poolId') poolId: string, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.poolsService.createJoinIntent(poolId, currentUser);
  }

  @Post(':poolId/join')
  async joinPool(
    @Param('poolId') poolId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: JoinPoolDto,
  ) {
    return this.poolsService.joinPool(poolId, currentUser, body);
  }

  @Post(':poolId/resolve')
  async resolvePool(
    @Param('poolId') poolId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: ResolvePoolDto,
  ) {
    return this.poolsService.resolvePool(poolId, currentUser, body);
  }

  @Post(':poolId/trades')
  async submitTrades(
    @Param('poolId') poolId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: SubmitPoolTradesDto,
  ) {
    return this.poolsService.submitTrades(poolId, currentUser, body);
  }

  @Get(':poolId/leaderboard')
  async getLeaderboard(@Param('poolId') poolId: string, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.poolsService.getLeaderboard(poolId, currentUser);
  }
}
