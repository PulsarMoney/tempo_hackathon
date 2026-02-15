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

  async verifyAccessToken(accessToken: string): Promise<AuthenticatedUser> {
    const normalizedToken = this.normalizeToken(accessToken);

    const resolved = await this.resolvePrivyIdentity(normalizedToken);

    const savedUser = await this.usersService.upsertFromPrivyUser({
      privyDid: resolved.privyDid,
      linkedAccounts: resolved.linkedAccounts,
    });

    const roles = await this.usersService.getRoles(savedUser.id);

    return {
      privyDid: savedUser.privyDid,
      userId: savedUser.id,
      walletAddress: savedUser.primaryWallet,
      roles,
      linkedAccounts: resolved.linkedAccounts,
    };
  }

  private async resolvePrivyIdentity(normalizedToken: string): Promise<{
    privyDid: string;
    linkedAccounts: Array<Record<string, unknown>>;
  }> {
    try {
      const verified = await this.privyClient.utils().auth().verifyAccessToken(normalizedToken);
      const hydrated = await this.safeHydrateLinkedAccounts(verified.user_id);
      return {
        privyDid: verified.user_id,
        linkedAccounts: hydrated,
      };
    } catch (accessError) {
      try {
        const verifiedLegacy = await this.privyClient.utils().auth().verifyAuthToken(normalizedToken);
        const hydrated = await this.safeHydrateLinkedAccounts(verifiedLegacy.user_id);
        return {
          privyDid: verifiedLegacy.user_id,
          linkedAccounts: hydrated,
        };
      } catch (authError) {
        try {
          const identityUser = await this.privyClient.utils().auth().verifyIdentityToken(normalizedToken);
          const linkedAccounts =
            (identityUser.linked_accounts as unknown as Array<Record<string, unknown>>) ?? [];
          return {
            privyDid: identityUser.id,
            linkedAccounts,
          };
        } catch (identityError) {
          const details =
            this.extractErrorMessage(identityError) ||
            this.extractErrorMessage(authError) ||
            this.extractErrorMessage(accessError);
          throw new UnauthorizedException(
            details ? `Invalid Privy access token (${details})` : 'Invalid Privy access token',
          );
        }
      }
    }
  }

  private async safeHydrateLinkedAccounts(privyDid: string): Promise<Array<Record<string, unknown>>> {
    try {
      const privyUser = await this.privyClient.users()._get(privyDid);
      return (privyUser.linked_accounts as unknown as Array<Record<string, unknown>>) ?? [];
    } catch {
      return [];
    }
  }

  private normalizeToken(token: string): string {
    const trimmed = token.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
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

  private extractErrorMessage(error: unknown): string | null {
    if (!error || typeof error !== 'object') {
      return null;
    }
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.length > 0) {
      return maybeMessage;
    }
    return null;
  }
}
