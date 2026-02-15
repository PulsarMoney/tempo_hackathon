import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  PoolEntity,
  PoolEventEntity,
  PoolPayoutEntity,
} from '../db/entities';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user';
import { ChainService } from '../chain/chain.service';

@Injectable()
export class PayoutsService {
  constructor(
    @InjectRepository(PoolEntity)
    private readonly poolsRepo: Repository<PoolEntity>,
    @InjectRepository(PoolPayoutEntity)
    private readonly payoutsRepo: Repository<PoolPayoutEntity>,
    @InjectRepository(PoolEventEntity)
    private readonly eventsRepo: Repository<PoolEventEntity>,
    private readonly chainService: ChainService,
  ) {}

  async executePayouts(input: { poolId: string; currentUser: AuthenticatedUser }) {
    const pool = await this.poolsRepo.findOne({
      where: { id: input.poolId },
      relations: {
        participants: { user: true },
        outcomes: true,
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    const isPrivileged = input.currentUser.roles.includes('admin') || input.currentUser.roles.includes('operator');
    const isCreator = pool.creatorUserId === input.currentUser.userId;
    if (!isCreator && !isPrivileged) {
      throw new ForbiddenException('Only the pool creator, admin, or operator can execute payouts');
    }

    if (pool.status !== 'resolved') {
      throw new BadRequestException('Pool must be resolved before payouts');
    }

    const outcome = pool.outcomes[pool.outcomes.length - 1];
    if (!outcome) {
      throw new BadRequestException('Pool has no outcome');
    }

    const joined = pool.participants.filter((participant) => participant.joinStatus === 'joined');
    if (joined.length === 0) {
      throw new BadRequestException('Pool has no joined participants');
    }

    const winnerPrivyDids = Array.isArray(outcome.outcomeJson.winnerPrivyDids)
      ? (outcome.outcomeJson.winnerPrivyDids as string[])
      : [];

    const winners =
      winnerPrivyDids.length > 0
        ? joined.filter((participant) => participant.user?.privyDid && winnerPrivyDids.includes(participant.user.privyDid))
        : joined;

    if (winners.length === 0) {
      throw new BadRequestException('No payout winners from outcome');
    }

    const executionId = uuidv4();
    const poolTotal = Number(pool.entryAmount) * joined.length;
    const payoutEach = (poolTotal / winners.length).toFixed(6);

    const createdRows: PoolPayoutEntity[] = [];
    for (const winner of winners) {
      if (!winner.walletAddress) {
        continue;
      }

      const memoReference = this.chainService.makePayoutReference(pool.id, winner.id);
      const memoHex = this.chainService.memoHex(memoReference);

      const payout = await this.payoutsRepo.save(
        this.payoutsRepo.create({
          poolId: pool.id,
          participantId: winner.id,
          executionId,
          amount: payoutEach,
          memoHex,
          memoReference,
          status: 'pending',
        }),
      );

      createdRows.push(payout);
    }

    const txHashes: string[] = [];
    const failures: Array<{ payoutId: string; reason: string }> = [];

    for (const payout of createdRows) {
      const participant = winners.find((winner) => winner.id === payout.participantId);
      if (!participant?.walletAddress) {
        payout.status = 'failed';
        payout.error = 'missing_wallet_address';
        await this.payoutsRepo.save(payout);
        failures.push({ payoutId: payout.id, reason: 'missing_wallet_address' });
        continue;
      }

      try {
        const sent = await this.chainService.executePayout({
          to: participant.walletAddress as `0x${string}`,
          amount: payout.amount,
          memoHex: payout.memoHex as `0x${string}`,
        });

        payout.txHash = sent.txHash;
        payout.status = 'confirmed';
        payout.error = null;
        await this.payoutsRepo.save(payout);
        txHashes.push(sent.txHash);
      } catch (error) {
        payout.status = 'failed';
        payout.error = error instanceof Error ? error.message : 'payout_failed';
        await this.payoutsRepo.save(payout);
        failures.push({ payoutId: payout.id, reason: payout.error });
      }
    }

    if (failures.length === 0) {
      pool.status = 'paid';
      await this.poolsRepo.save(pool);
    }

    await this.eventsRepo.save(
      this.eventsRepo.create({
        poolId: pool.id,
        eventType: 'payout.executed',
        actorUserId: input.currentUser.userId,
        payloadJson: {
          executionId,
          txHashes,
          failures,
        },
      }),
    );

    return {
      executionId,
      txHashes,
      failures,
      status: failures.length === 0 ? 'confirmed' : txHashes.length > 0 ? 'partial' : 'failed',
    };
  }

  async getExecutionStatus(executionId: string) {
    const payouts = await this.payoutsRepo.find({ where: { executionId } });
    if (payouts.length === 0) {
      throw new NotFoundException('Execution not found');
    }

    const failures = payouts
      .filter((payout) => payout.status === 'failed')
      .map((payout) => ({ payoutId: payout.id, reason: payout.error ?? 'unknown' }));

    const txHashes = payouts.map((payout) => payout.txHash).filter((hash): hash is string => Boolean(hash));

    const status =
      failures.length === 0 && payouts.every((payout) => payout.status === 'confirmed')
        ? 'confirmed'
        : txHashes.length > 0
          ? 'pending'
          : 'failed';

    return { status, txHashes, failures };
  }
}
