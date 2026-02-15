import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAccountEntity, UserEntity, UserRoleEntity } from '../db/entities';
import { UserAccountType } from '../db/user-account.entity';

export type LinkedAccountInput = {
  type?: string;
  address?: string | null;
  number?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  username?: string | null;
  subject?: string | null;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    @InjectRepository(UserAccountEntity)
    private readonly userAccountsRepo: Repository<UserAccountEntity>,
    @InjectRepository(UserRoleEntity)
    private readonly userRolesRepo: Repository<UserRoleEntity>,
  ) {}

  async upsertFromPrivyUser(input: {
    privyDid: string;
    linkedAccounts: LinkedAccountInput[];
  }): Promise<UserEntity> {
    const existing = await this.usersRepo.findOne({ where: { privyDid: input.privyDid } });
    const primaryWallet = this.getPrimaryWallet(input.linkedAccounts) ?? null;

    const user = existing
      ? this.usersRepo.merge(existing, { primaryWallet })
      : this.usersRepo.create({ privyDid: input.privyDid, primaryWallet });

    const savedUser = await this.usersRepo.save(user);

    await this.syncAccounts(savedUser.id, input.linkedAccounts);
    return savedUser;
  }

  async getUserByPrivyDid(privyDid: string): Promise<UserEntity | null> {
    return this.usersRepo.findOne({ where: { privyDid } });
  }

  async getRoles(userId: string): Promise<string[]> {
    const roles = await this.userRolesRepo.find({ where: { userId } });
    return roles.map((r) => r.role);
  }

  private getPrimaryWallet(accounts: LinkedAccountInput[]): string | undefined {
    const wallet = accounts.find((a) => a.type === 'wallet' && Boolean(a.address));
    return wallet?.address ?? undefined;
  }

  private normalizeAccount(account: LinkedAccountInput): { type: UserAccountType; value: string } | null {
    if (account.type === 'email') {
      const value = account.address ?? account.email;
      if (value) {
        return { type: 'email', value };
      }
    }

    if (account.type === 'phone') {
      const value = account.number ?? account.phoneNumber;
      if (value) {
        return { type: 'phone', value };
      }
    }

    if (account.type === 'wallet' && account.address) {
      return { type: 'wallet', value: account.address };
    }

    if (account.type && (account.username ?? account.subject)) {
      return { type: 'social', value: `${account.type}:${account.username ?? account.subject}` };
    }

    return null;
  }

  private async syncAccounts(userId: string, accounts: LinkedAccountInput[]) {
    const normalized = accounts
      .map((account) => this.normalizeAccount(account))
      .filter((entry): entry is { type: UserAccountType; value: string } => Boolean(entry));

    for (const entry of normalized) {
      const exists = await this.userAccountsRepo.findOne({
        where: {
          userId,
          accountType: entry.type,
          accountValue: entry.value,
        },
      });

      if (!exists) {
        const accountEntity = this.userAccountsRepo.create({
          userId,
          accountType: entry.type,
          accountValue: entry.value,
          verifiedAt: new Date(),
        });
        await this.userAccountsRepo.save(accountEntity);
      }
    }
  }
}
