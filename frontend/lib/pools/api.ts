export type PoolSummary = {
  id: string;
  title: string;
  status: string;
  entryAmount: string;
  tokenAddress: string;
  closeAt: string;
  participants?: Array<{ id: string; joinStatus: string; walletAddress: string | null; joinTxHash: string | null }>;
  payouts?: Array<{ id: string; amount: string; txHash: string | null; status: string }>;
  events?: Array<{ id: string; eventType: string; createdAt: string }>;
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
