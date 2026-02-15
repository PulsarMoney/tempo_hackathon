import {
  BadRequestException,
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
  UserEntity,
} from '../db/entities';
import { ChainService } from '../chain/chain.service';
import { CreatePoolDto, JoinPoolDto, ResolvePoolDto } from './dto';
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

  async getPool(poolId: string) {
    const pool = await this.poolsRepo.findOne({
      where: { id: poolId },
      relations: {
        participants: true,
        payouts: true,
        outcomes: true,
        events: true,
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

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

  async resolvePool(poolId: string, currentUser: AuthenticatedUser, dto: ResolvePoolDto) {
    const pool = await this.poolsRepo.findOne({ where: { id: poolId } });
    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    if (pool.status === 'resolved' || pool.status === 'paid') {
      throw new BadRequestException('Pool already resolved');
    }

    const outcome = await this.outcomesRepo.save(
      this.outcomesRepo.create({
        poolId,
        outcomeJson: {
          ...dto.outcome,
          winnerPrivyDids: dto.winnerPrivyDids ?? [],
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
          outcome: dto.outcome,
        },
      }),
    );

    return { status: 'resolved', payoutPlanId };
  }
}
