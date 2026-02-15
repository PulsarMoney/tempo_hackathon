import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Hex } from 'viem';
import {
  PoolEntity,
  PoolEventEntity,
  PoolOutcomeEntity,
  PoolParticipantEntity,
  PoolTradeEventEntity,
  UserEntity,
} from '../db/entities';
import { ChainService } from '../chain/chain.service';
import { CreatePoolDto, JoinPoolDto, PoolTradeEventDto, ResolvePoolDto, SubmitPoolTradesDto } from './dto';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user';

@Injectable()
export class PoolsService {
  constructor(
    @InjectRepository(PoolEntity)
    private readonly poolsRepo: Repository<PoolEntity>,
    @InjectRepository(PoolParticipantEntity)
    private readonly participantsRepo: Repository<PoolParticipantEntity>,
    @InjectRepository(PoolOutcomeEntity)
    private readonly outcomesRepo: Repository<PoolOutcomeEntity>,
    @InjectRepository(PoolEventEntity)
    private readonly eventsRepo: Repository<PoolEventEntity>,
    @InjectRepository(PoolTradeEventEntity)
    private readonly tradeEventsRepo: Repository<PoolTradeEventEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    private readonly chainService: ChainService,
  ) {}

  async createPool(currentUser: AuthenticatedUser, dto: CreatePoolDto) {
    const creator = await this.usersRepo.findOne({ where: { id: currentUser.userId } });
    if (!creator) {
      throw new NotFoundException('Creator user not found');
    }

    if (!this.chainService.isDemoToken(dto.tokenAddress)) {
      throw new BadRequestException(
        `Pool token must match configured DEMO_TOKEN_ADDRESS (${this.chainService.getDemoTokenAddress()})`,
      );
    }

    const pool = await this.poolsRepo.save(
      this.poolsRepo.create({
        title: dto.title,
        creatorUserId: currentUser.userId,
        entryAmount: dto.entryAmount,
        tokenAddress: dto.tokenAddress,
        status: 'open',
        closeAt: new Date(dto.closeAt),
      }),
    );

    await this.eventsRepo.save(
      this.eventsRepo.create({
        poolId: pool.id,
        eventType: 'pool.created',
        actorUserId: currentUser.userId,
        payloadJson: {
          title: pool.title,
          entryAmount: pool.entryAmount,
          tokenAddress: pool.tokenAddress,
          resolveMode: dto.resolveMode,
        },
      }),
    );

    return { poolId: pool.id, status: pool.status };
  }

  async listMyPools(currentUser: AuthenticatedUser) {
    const pools = await this.poolsRepo
      .createQueryBuilder('pool')
      .leftJoinAndSelect('pool.participants', 'participant')
      .where('pool.creator_user_id = :userId', { userId: currentUser.userId })
      .orWhere('participant.user_id = :userId', { userId: currentUser.userId })
      .orderBy('pool.created_at', 'DESC')
      .getMany();

    for (const pool of pools) {
      await this.syncPoolClosedState(pool, currentUser.userId);
    }

    const unique = new Map<string, PoolEntity>();
    for (const pool of pools) {
      unique.set(pool.id, pool);
    }

    return {
      pools: Array.from(unique.values()).map((pool) => ({
        id: pool.id,
        title: pool.title,
        status: pool.status,
        entryAmount: pool.entryAmount,
        tokenAddress: pool.tokenAddress,
        closeAt: pool.closeAt,
        creatorUserId: pool.creatorUserId,
        participantCount: pool.participants?.length ?? 0,
      })),
    };
  }

  async getPool(poolId: string, currentUser: AuthenticatedUser) {
    const pool = await this.poolsRepo.findOne({
      where: { id: poolId },
      relations: {
        participants: { user: true },
        payouts: true,
        outcomes: true,
        events: true,
        tradeEvents: true,
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    await this.syncPoolClosedState(pool, currentUser.userId);

    return {
      id: pool.id,
      title: pool.title,
      status: pool.status,
      creatorUserId: pool.creatorUserId,
      entryAmount: pool.entryAmount,
      tokenAddress: pool.tokenAddress,
      closeAt: pool.closeAt,
      resolvedAt: pool.resolvedAt,
      participants: pool.participants,
      payouts: pool.payouts,
      outcomes: pool.outcomes,
      events: pool.events,
    };
  }

  async createJoinIntent(poolId: string, currentUser: AuthenticatedUser) {
    const pool = await this.poolsRepo.findOne({ where: { id: poolId } });
    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    await this.syncPoolClosedState(pool, currentUser.userId);

    if (pool.status !== 'open') {
      throw new BadRequestException('Pool is not open for joins');
    }

    let participant = await this.participantsRepo.findOne({
      where: { poolId, userId: currentUser.userId },
    });

    if (!participant) {
      participant = await this.participantsRepo.save(
        this.participantsRepo.create({
          poolId,
          userId: currentUser.userId,
          walletAddress: currentUser.walletAddress,
          joinStatus: 'invited',
        }),
      );
    }

    const joinReference = this.chainService.makeJoinReference(poolId, participant.id);
    const memoHex = this.chainService.memoHex(joinReference);

    return {
      participantId: participant.id,
      joinReference,
      memoHex,
      entryAmount: pool.entryAmount,
      tokenAddress: pool.tokenAddress,
    };
  }

  async joinPool(poolId: string, currentUser: AuthenticatedUser, dto: JoinPoolDto) {
    const pool = await this.poolsRepo.findOne({ where: { id: poolId } });
    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    await this.syncPoolClosedState(pool, currentUser.userId);

    if (pool.status !== 'open') {
      throw new BadRequestException('Pool is not open for joins');
    }

    let participant = await this.participantsRepo.findOne({
      where: { poolId, userId: currentUser.userId },
    });

    if (!participant) {
      participant = await this.participantsRepo.save(
        this.participantsRepo.create({
          poolId,
          userId: currentUser.userId,
          walletAddress: dto.userAddress,
          joinStatus: 'invited',
        }),
      );
    }

    const joinReference = this.chainService.makeJoinReference(poolId, participant.id);
    const expectedMemoHex = this.chainService.memoHex(joinReference);

    if (dto.memoHex.toLowerCase() !== expectedMemoHex.toLowerCase()) {
      throw new BadRequestException('Invalid memo provided for participant');
    }

    const verification = await this.chainService.verifyJoinTransfer({
      txHash: dto.joinTxHash as Hex,
      expectedAmount: pool.entryAmount,
      expectedMemoHex,
    });

    if (!verification.valid) {
      throw new BadRequestException(`Join tx rejected: ${verification.reason}`);
    }

    participant.joinStatus = 'joined';
    participant.joinTxHash = dto.joinTxHash;
    participant.joinMemoHex = dto.memoHex;
    participant.joinReference = joinReference;
    participant.joinedAt = new Date();
    await this.participantsRepo.save(participant);

    await this.eventsRepo.save(
      this.eventsRepo.create({
        poolId,
        eventType: 'participant.joined',
        actorUserId: currentUser.userId,
        payloadJson: {
          participantId: participant.id,
          txHash: dto.joinTxHash,
          memoHex: dto.memoHex,
          joinReference,
        },
      }),
    );

    return { accepted: true, participantId: participant.id };
  }

  async submitTrades(poolId: string, currentUser: AuthenticatedUser, dto: SubmitPoolTradesDto) {
    const pool = await this.poolsRepo.findOne({ where: { id: poolId } });
    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    await this.syncPoolClosedState(pool, currentUser.userId);

    const participant = await this.participantsRepo.findOne({
      where: { poolId, userId: currentUser.userId },
    });

    if (!participant || participant.joinStatus !== 'joined') {
      throw new ForbiddenException('Only joined participants can submit pool trades');
    }

    if (!Array.isArray(dto.trades) || dto.trades.length === 0) {
      return { accepted: true, inserted: 0 };
    }

    let inserted = 0;
    for (const trade of dto.trades) {
      const normalized = this.normalizeTrade(trade);
      const existing = await this.tradeEventsRepo.findOne({
        where: {
          poolId,
          betId: normalized.betId,
        },
      });

      if (existing) {
        continue;
      }

      await this.tradeEventsRepo.save(
        this.tradeEventsRepo.create({
          poolId,
          userId: currentUser.userId,
          betId: normalized.betId,
          status: normalized.status,
          stake: normalized.stake,
          payout: normalized.payout,
          resolvedAtTick: normalized.resolvedAtTick,
        }),
      );
      inserted += 1;
    }

    if (inserted > 0) {
      await this.eventsRepo.save(
        this.eventsRepo.create({
          poolId,
          eventType: 'trades.synced',
          actorUserId: currentUser.userId,
          payloadJson: {
            inserted,
            total: dto.trades.length,
          },
        }),
      );
    }

    return { accepted: true, inserted };
  }

  async getLeaderboard(poolId: string, currentUser: AuthenticatedUser) {
    const pool = await this.poolsRepo.findOne({
      where: { id: poolId },
      relations: {
        participants: true,
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    await this.syncPoolClosedState(pool, currentUser.userId);

    const joined = pool.participants.filter((participant) => participant.joinStatus === 'joined');
    const aggregates = await this.getTradeAggregatesByUser(poolId);

    const ranked = joined
      .map((participant) => {
        const aggregate = participant.userId ? aggregates.get(participant.userId) : undefined;
        return {
          participantId: participant.id,
          userId: participant.userId,
          walletAddress: participant.walletAddress,
          submitted: Boolean(aggregate),
          pnl: aggregate ? aggregate.pnl.toFixed(8) : null,
          wins: aggregate?.wins ?? 0,
          losses: aggregate?.losses ?? 0,
          totalStake: aggregate ? aggregate.totalStake.toFixed(8) : null,
          totalPayout: aggregate ? aggregate.totalPayout.toFixed(8) : null,
        };
      })
      .sort((a, b) => {
        const aPnl = a.pnl ? Number(a.pnl) : -Infinity;
        const bPnl = b.pnl ? Number(b.pnl) : -Infinity;
        return bPnl - aPnl;
      });

    let currentRank = 0;
    let previousPnl: string | null = null;

    const leaderboard = ranked.map((row, idx) => {
      if (row.pnl === null) {
        return { ...row, rank: null };
      }

      if (row.pnl !== previousPnl) {
        currentRank = idx + 1;
        previousPnl = row.pnl;
      }

      return {
        ...row,
        rank: currentRank,
      };
    });

    return {
      poolId,
      status: pool.status,
      leaderboard,
    };
  }

  async resolvePool(poolId: string, currentUser: AuthenticatedUser, dto: ResolvePoolDto) {
    const pool = await this.poolsRepo.findOne({
      where: { id: poolId },
      relations: {
        participants: { user: true },
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    await this.syncPoolClosedState(pool, currentUser.userId);

    const isPrivileged = currentUser.roles.includes('admin') || currentUser.roles.includes('operator');
    const isCreator = pool.creatorUserId === currentUser.userId;
    if (!isCreator && !isPrivileged) {
      throw new ForbiddenException('Only the pool creator, admin, or operator can resolve this pool');
    }

    if (pool.status === 'resolved' || pool.status === 'paid') {
      throw new BadRequestException('Pool already resolved');
    }

    if (pool.status !== 'closed') {
      throw new BadRequestException('Pool must be closed before resolving winners');
    }

    const joined = pool.participants.filter((participant) => participant.joinStatus === 'joined');
    if (joined.length === 0) {
      throw new BadRequestException('Pool has no joined participants');
    }

    const aggregates = await this.getTradeAggregatesByUser(poolId);
    const winnerPrivyDids =
      dto.winnerPrivyDids && dto.winnerPrivyDids.length > 0
        ? dto.winnerPrivyDids
        : this.computeAutoWinnerPrivyDids(joined, aggregates);

    if (winnerPrivyDids.length === 0) {
      throw new BadRequestException('No winners could be determined from synced pool trades');
    }

    const rankingSnapshot = this.computeRankingSnapshot(joined, aggregates);

    const outcome = await this.outcomesRepo.save(
      this.outcomesRepo.create({
        poolId,
        outcomeJson: {
          ...dto.outcome,
          winnerPrivyDids,
          rankingSnapshot,
          winnerSelectionMode: dto.winnerPrivyDids?.length ? 'manual' : 'auto_trade_pnl',
        },
        resolvedByUserId: currentUser.userId,
        resolveNote: dto.reason,
      }),
    );

    pool.status = 'resolved';
    pool.resolvedAt = new Date();
    await this.poolsRepo.save(pool);

    const payoutPlanId = uuidv4();

    await this.eventsRepo.save(
      this.eventsRepo.create({
        poolId,
        eventType: 'pool.resolved',
        actorUserId: currentUser.userId,
        payloadJson: {
          payoutPlanId,
          outcomeId: outcome.id,
          reason: dto.reason,
          winnerPrivyDids,
          rankingSnapshot,
        },
      }),
    );

    return { status: 'resolved', payoutPlanId };
  }

  private computeAutoWinnerPrivyDids(
    joined: Array<PoolParticipantEntity>,
    aggregates: Map<string, { pnl: number }>,
  ): string[] {

    const scoredJoined = joined
      .map((participant) => {
        if (!participant.userId) {
          return null;
        }
        const aggregate = aggregates.get(participant.userId);
        if (!aggregate || !participant.user?.privyDid) {
          return null;
        }
        return {
          privyDid: participant.user.privyDid,
          pnl: aggregate.pnl,
        };
      })
      .filter((entry): entry is { privyDid: string; pnl: number } => Boolean(entry));

    if (scoredJoined.length === 0) {
      return [];
    }

    scoredJoined.sort((a, b) => b.pnl - a.pnl);
    const topPnl = scoredJoined[0].pnl;

    return scoredJoined.filter((entry) => entry.pnl === topPnl).map((entry) => entry.privyDid);
  }

  private computeRankingSnapshot(
    joined: Array<PoolParticipantEntity>,
    aggregates: Map<string, { pnl: number; wins: number; losses: number }>,
  ) {

    const rankedRows = joined
      .map((participant) => {
        const aggregate = participant.userId ? aggregates.get(participant.userId) : undefined;
        return {
          participantId: participant.id,
          walletAddress: participant.walletAddress,
          userId: participant.userId,
          privyDid: participant.user?.privyDid ?? null,
          submitted: Boolean(aggregate),
          pnl: aggregate ? aggregate.pnl.toFixed(8) : null,
          wins: aggregate?.wins ?? 0,
          losses: aggregate?.losses ?? 0,
        };
      })
      .sort((a, b) => {
        if (!a.submitted && !b.submitted) return 0;
        if (!a.submitted) return 1;
        if (!b.submitted) return -1;
        return Number(b.pnl) - Number(a.pnl);
      });

    let currentRank = 0;
    let previousPnl: string | null = null;

    return rankedRows.map((row, idx) => {
      if (!row.submitted) {
        return { ...row, rank: null };
      }
      if (row.pnl !== previousPnl) {
        currentRank = idx + 1;
        previousPnl = row.pnl;
      }
      return { ...row, rank: currentRank };
    });
  }

  private async getTradeAggregatesByUser(poolId: string) {
    const rows = await this.tradeEventsRepo.find({
      where: { poolId },
    });

    const map = new Map<
      string,
      { totalStake: number; totalPayout: number; pnl: number; wins: number; losses: number }
    >();

    for (const row of rows) {
      const entry = map.get(row.userId) ?? {
        totalStake: 0,
        totalPayout: 0,
        pnl: 0,
        wins: 0,
        losses: 0,
      };
      const stake = Number(row.stake);
      const payout = Number(row.payout);
      entry.totalStake += stake;
      entry.totalPayout += payout;
      entry.pnl = entry.totalPayout - entry.totalStake;
      if (row.status === 'won') {
        entry.wins += 1;
      } else {
        entry.losses += 1;
      }
      map.set(row.userId, entry);
    }

    return map;
  }

  private normalizeTrade(trade: PoolTradeEventDto) {
    const status: 'won' | 'lost' | null =
      trade.status === 'won' ? 'won' : trade.status === 'lost' ? 'lost' : null;
    if (!status) {
      throw new BadRequestException(`Invalid trade status: ${trade.status}`);
    }
    const resolvedAtTick = Number(trade.resolvedAtTick);
    if (!Number.isFinite(resolvedAtTick) || resolvedAtTick < 0) {
      throw new BadRequestException('Invalid resolvedAtTick');
    }
    const stake = Number(trade.stake);
    const payout = Number(trade.payout);
    if (!Number.isFinite(stake) || !Number.isFinite(payout)) {
      throw new BadRequestException('Invalid trade amount');
    }

    return {
      betId: trade.betId,
      status,
      stake: stake.toFixed(8),
      payout: payout.toFixed(8),
      resolvedAtTick: Math.floor(resolvedAtTick),
    };
  }

  private async syncPoolClosedState(pool: PoolEntity, actorUserId?: string | null) {
    if (pool.status !== 'open') {
      return;
    }

    if (new Date() < pool.closeAt) {
      return;
    }

    pool.status = 'closed';
    await this.poolsRepo.save(pool);

    await this.eventsRepo.save(
      this.eventsRepo.create({
        poolId: pool.id,
        eventType: 'pool.closed',
        actorUserId: actorUserId ?? null,
        payloadJson: {
          closeAt: pool.closeAt,
          reason: 'auto_close_at_reached',
        },
      }),
    );
  }
}
