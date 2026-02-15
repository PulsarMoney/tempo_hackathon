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
  PoolScoreEntity,
  UserEntity,
} from '../db/entities';
import { ChainService } from '../chain/chain.service';
import { CreatePoolDto, JoinPoolDto, ResolvePoolDto, SubmitPoolScoreDto } from './dto';
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
    @InjectRepository(PoolScoreEntity)
    private readonly scoresRepo: Repository<PoolScoreEntity>,
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
        scores: { user: true },
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
      scores: pool.scores.map((score) => ({
        id: score.id,
        userId: score.userId,
        pnl: score.pnl,
        totalStake: score.totalStake,
        totalPayout: score.totalPayout,
        wins: score.wins,
        losses: score.losses,
        submittedAt: score.submittedAt,
      })),
      myScoreSubmitted: pool.scores.some((score) => score.userId === currentUser.userId),
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

  async submitScore(poolId: string, currentUser: AuthenticatedUser, dto: SubmitPoolScoreDto) {
    const pool = await this.poolsRepo.findOne({ where: { id: poolId } });
    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    await this.syncPoolClosedState(pool, currentUser.userId);

    if (pool.status !== 'closed' && pool.status !== 'resolved') {
      throw new BadRequestException('Scores can be submitted only when pool is closed or resolved');
    }

    const participant = await this.participantsRepo.findOne({
      where: { poolId, userId: currentUser.userId },
    });

    if (!participant || participant.joinStatus !== 'joined') {
      throw new ForbiddenException('Only joined participants can submit scores');
    }

    const existing = await this.scoresRepo.findOne({ where: { poolId, userId: currentUser.userId } });

    const saved = await this.scoresRepo.save(
      this.scoresRepo.create({
        id: existing?.id,
        poolId,
        userId: currentUser.userId,
        pnl: dto.pnl,
        totalStake: dto.totalStake,
        totalPayout: dto.totalPayout,
        wins: dto.wins,
        losses: dto.losses,
      }),
    );

    await this.eventsRepo.save(
      this.eventsRepo.create({
        poolId,
        eventType: 'score.submitted',
        actorUserId: currentUser.userId,
        payloadJson: {
          scoreId: saved.id,
          pnl: saved.pnl,
          wins: saved.wins,
          losses: saved.losses,
          totalStake: saved.totalStake,
          totalPayout: saved.totalPayout,
        },
      }),
    );

    return { accepted: true, scoreId: saved.id };
  }

  async getLeaderboard(poolId: string, currentUser: AuthenticatedUser) {
    const pool = await this.poolsRepo.findOne({
      where: { id: poolId },
      relations: {
        participants: true,
        scores: true,
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    await this.syncPoolClosedState(pool, currentUser.userId);

    const joined = pool.participants.filter((participant) => participant.joinStatus === 'joined');
    const scoresByUser = new Map(pool.scores.map((score) => [score.userId, score]));

    const ranked = joined
      .map((participant) => {
        const score = participant.userId ? scoresByUser.get(participant.userId) : undefined;
        return {
          participantId: participant.id,
          userId: participant.userId,
          walletAddress: participant.walletAddress,
          submitted: Boolean(score),
          pnl: score?.pnl ?? null,
          wins: score?.wins ?? 0,
          losses: score?.losses ?? 0,
          totalStake: score?.totalStake ?? null,
          totalPayout: score?.totalPayout ?? null,
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

    const leaderboard = ranked.map((row, idx) => {
      if (!row.submitted) {
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
        scores: true,
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

    const winnerPrivyDids =
      dto.winnerPrivyDids && dto.winnerPrivyDids.length > 0
        ? dto.winnerPrivyDids
        : this.computeAutoWinnerPrivyDids(joined, pool.scores);

    if (winnerPrivyDids.length === 0) {
      throw new BadRequestException('No winners could be determined from submitted scores');
    }

    const rankingSnapshot = this.computeRankingSnapshot(joined, pool.scores);

    const outcome = await this.outcomesRepo.save(
      this.outcomesRepo.create({
        poolId,
        outcomeJson: {
          ...dto.outcome,
          winnerPrivyDids,
          rankingSnapshot,
          winnerSelectionMode: dto.winnerPrivyDids?.length ? 'manual' : 'auto_score',
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
    scores: Array<PoolScoreEntity>,
  ): string[] {
    const scoreByUser = new Map(scores.map((score) => [score.userId, score]));

    const scoredJoined = joined
      .map((participant) => {
        if (!participant.userId) {
          return null;
        }
        const score = scoreByUser.get(participant.userId);
        if (!score || !participant.user?.privyDid) {
          return null;
        }
        return {
          privyDid: participant.user.privyDid,
          pnl: Number(score.pnl),
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

  private computeRankingSnapshot(joined: Array<PoolParticipantEntity>, scores: Array<PoolScoreEntity>) {
    const scoreByUser = new Map(scores.map((score) => [score.userId, score]));

    const rankedRows = joined
      .map((participant) => {
        const score = participant.userId ? scoreByUser.get(participant.userId) : undefined;
        return {
          participantId: participant.id,
          walletAddress: participant.walletAddress,
          userId: participant.userId,
          privyDid: participant.user?.privyDid ?? null,
          submitted: Boolean(score),
          pnl: score?.pnl ?? null,
          wins: score?.wins ?? 0,
          losses: score?.losses ?? 0,
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
