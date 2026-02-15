export type AuthenticatedUser = {
  privyDid: string;
  userId: string;
  walletAddress: string | null;
  roles: string[];
  linkedAccounts: unknown[];
};
