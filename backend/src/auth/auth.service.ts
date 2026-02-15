import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrivyClient } from '@privy-io/node';
import { UsersService } from '../users/users.service';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user';

@Injectable()
export class AuthService {
  private readonly privyClient: PrivyClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const appId = this.configService.get<string>('PRIVY_APP_ID');
    const appSecret = this.configService.get<string>('PRIVY_APP_SECRET');

    if (!appId || !appSecret) {
      throw new Error('Missing PRIVY_APP_ID/PRIVY_APP_SECRET in backend env');
    }

    this.privyClient = new PrivyClient({
      appId,
      appSecret,
      jwtVerificationKey: this.configService.get<string>('PRIVY_VERIFICATION_KEY'),
    });
  }

  async verifyAccessToken(accessToken: string): Promise<AuthenticatedUser> {
    let verified:
      | {
          user_id: string;
        }
      | undefined;

    try {
      verified = await this.privyClient.utils().auth().verifyAccessToken(accessToken);
    } catch {
      try {
        verified = await this.privyClient.utils().auth().verifyAuthToken(accessToken);
      } catch {
        throw new UnauthorizedException('Invalid Privy access token');
      }
    }

    let linkedAccounts: Array<Record<string, unknown>> = [];
    try {
      const privyUser = await this.privyClient.users()._get(verified.user_id);
      linkedAccounts = (privyUser.linked_accounts as unknown as Array<Record<string, unknown>>) ?? [];
    } catch {
      // If profile hydration fails, we still trust the verified access token and continue.
      linkedAccounts = [];
    }

    const savedUser = await this.usersService.upsertFromPrivyUser({
      privyDid: verified.user_id,
      linkedAccounts,
    });

    const roles = await this.usersService.getRoles(savedUser.id);

    return {
      privyDid: savedUser.privyDid,
      userId: savedUser.id,
      walletAddress: savedUser.primaryWallet,
      roles,
      linkedAccounts,
    };
  }
}
