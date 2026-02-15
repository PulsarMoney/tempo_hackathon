import { getPgPool } from "@/lib/server/db";

export type PrivyUserUpsertInput = {
  privyUserId: string;
  sessionId: string;
  walletAddress?: string | null;
  walletChainId?: string | null;
  linkedAccounts?: unknown;
};

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS privy_users (
    privy_user_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    wallet_address TEXT,
    wallet_chain_id TEXT,
    linked_accounts JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

const UPSERT_SQL = `
  INSERT INTO privy_users (
    privy_user_id,
    session_id,
    wallet_address,
    wallet_chain_id,
    linked_accounts,
    created_at,
    updated_at,
    last_login_at
  )
  VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), NOW(), NOW())
  ON CONFLICT (privy_user_id)
  DO UPDATE SET
    session_id = EXCLUDED.session_id,
    wallet_address = EXCLUDED.wallet_address,
    wallet_chain_id = EXCLUDED.wallet_chain_id,
    linked_accounts = EXCLUDED.linked_accounts,
    updated_at = NOW(),
    last_login_at = NOW();
`;

export async function upsertPrivyUser(input: PrivyUserUpsertInput): Promise<{ persisted: boolean }> {
  const pool = getPgPool();
  if (!pool) {
    return { persisted: false };
  }

  await pool.query(CREATE_TABLE_SQL);
  await pool.query(UPSERT_SQL, [
    input.privyUserId,
    input.sessionId,
    input.walletAddress ?? null,
    input.walletChainId ?? null,
    JSON.stringify(input.linkedAccounts ?? null),
  ]);

  return { persisted: true };
}
