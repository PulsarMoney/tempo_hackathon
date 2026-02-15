export type PoolSummary = {
  id: string;
  title: string;
  status: string;
  creatorUserId?: string;
  entryAmount: string;
  tokenAddress: string;
  closeAt: string;
  resolvedAt?: string | null;
  participants?: Array<{
    id: string;
    userId?: string | null;
    joinStatus: string;
    walletAddress: string | null;
    joinTxHash: string | null;
  }>;
  payouts?: Array<{ id: string; participantId: string; amount: string; txHash: string | null; status: string }>;
  outcomes?: Array<{ id: string; outcomeJson?: Record<string, unknown> }>;
  events?: Array<{ id: string; eventType: string; createdAt: string; payloadJson?: Record<string, unknown> | null }>;
  scores?: Array<{
    id: string;
    userId: string;
    pnl: string;
    totalStake: string;
    totalPayout: string;
    wins: number;
    losses: number;
    submittedAt: string;
  }>;
  myScoreSubmitted?: boolean;
};

export type MyPoolSummary = {
  id: string;
  title: string;
  status: "open" | "closed" | "resolved" | "paid";
  entryAmount: string;
  tokenAddress: string;
  closeAt: string;
  creatorUserId: string;
  participantCount: number;
};

export type LeaderboardRow = {
  participantId: string;
  userId: string | null;
  walletAddress: string | null;
  pnl: string | null;
  rank: number | null;
};

const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function createPool(
  token: string,
  body: {
    title: string;
    entryAmount: string;
    tokenAddress: string;
    closeAt: string;
    resolveMode: 'manual_admin';
  },
) {
  return request<{ poolId: string; status: string }>('/pools', token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getPool(token: string, poolId: string) {
  return request<PoolSummary>(`/pools/${poolId}`, token);
}

export async function listMyPools(token: string) {
  return request<{ pools: MyPoolSummary[] }>('/pools', token);
}

export async function createJoinIntent(token: string, poolId: string) {
  return request<{
    participantId: string;
    joinReference: string;
    memoHex: `0x${string}`;
    entryAmount: string;
    tokenAddress: string;
  }>(`/pools/${poolId}/join-intent`, token, { method: 'POST' });
}

export async function confirmJoin(
  token: string,
  poolId: string,
  body: { userAddress: string; joinTxHash: string; memoHex: string },
) {
  return request<{ accepted: true; participantId: string }>(`/pools/${poolId}/join`, token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function resolvePool(
  token: string,
  poolId: string,
  body: { outcome: Record<string, unknown>; reason: string; winnerPrivyDids?: string[] },
) {
  return request<{ status: 'resolved'; payoutPlanId: string }>(`/pools/${poolId}/resolve`, token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function submitPoolTrades(
  token: string,
  poolId: string,
  body: {
    trades: Array<{
      betId: string;
      status: "won" | "lost";
      stake: string;
      payout: string;
      resolvedAtTick: string;
    }>;
  },
) {
  return request<{ accepted: true; inserted: number }>(`/pools/${poolId}/trades`, token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getPoolLeaderboard(token: string, poolId: string) {
  return request<{ poolId: string; status: string; leaderboard: LeaderboardRow[] }>(`/pools/${poolId}/leaderboard`, token);
}

export async function executePayout(token: string, poolId: string) {
  return request<{ executionId: string; txHashes: string[]; status: string; failures: Array<{ payoutId: string; reason: string }> }>(
    '/payouts/execute',
    token,
    {
      method: 'POST',
      body: JSON.stringify({ poolId }),
    },
  );
}

export async function getPayoutExecution(token: string, executionId: string) {
  return request<{ status: 'pending' | 'confirmed' | 'failed'; txHashes: string[]; failures: Array<{ payoutId: string; reason: string }> }>(
    `/payouts/${executionId}`,
    token,
  );
}
