import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrivyClient, User } from '@privy-io/node';
import { ContactIdentifierType } from './dto';

@Injectable()
export class ContactsService {
  private readonly privyClient: PrivyClient;

  constructor(private readonly configService: ConfigService) {
    const appId = this.configService.get<string>('PRIVY_APP_ID');
    const appSecret = this.configService.get<string>('PRIVY_APP_SECRET');
    const verificationKey = this.getOptionalVerificationKey();

    if (!appId || !appSecret) {
      throw new Error('Missing PRIVY_APP_ID/PRIVY_APP_SECRET in backend env');
    }

    this.privyClient = new PrivyClient({
      appId,
      appSecret,
      jwtVerificationKey: verificationKey,
    });
  }

  async findByIdentifier(input: { type: ContactIdentifierType; value: string }) {
    try {
      const user =
        input.type === ContactIdentifierType.EMAIL
          ? await this.privyClient.users().getByEmailAddress({ address: input.value })
          : await this.privyClient.users().getByPhoneNumber({ number: input.value });

      return {
        found: true,
        user: this.mapUser(user),
      };
    } catch {
      return { found: false as const };
    }
  }

  private mapUser(user: User) {
    const linkedAccounts = user.linked_accounts as unknown as Array<Record<string, unknown>>;

    const wallet = linkedAccounts.find(
      (account) => account.type === 'wallet' && typeof account.address === 'string',
    ) as { address?: string } | undefined;

    const displayName = linkedAccounts.find(
      (account) => typeof account.username === 'string' && account.username.length > 0,
    ) as { username?: string } | undefined;

    return {
      privyDid: user.id,
      walletAddress: wallet?.address ?? null,
      displayName: displayName?.username ?? null,
    };
  }

  private getOptionalVerificationKey(): string | undefined {
    const raw = this.configService.get<string>('PRIVY_VERIFICATION_KEY')?.trim();
    if (!raw) {
      return undefined;
    }

    const normalized = raw.replace(/\\n/g, '\n');
    const hasPemEnvelope =
      normalized.includes('-----BEGIN PUBLIC KEY-----') && normalized.includes('-----END PUBLIC KEY-----');

    return hasPemEnvelope ? normalized : undefined;
  }
}
