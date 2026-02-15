"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useActiveWallet, useLogin, usePrivy } from "@privy-io/react-auth";
import { encodeFunctionData, parseUnits } from "viem";
import { Copy, ExternalLink, Link2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  confirmJoin,
  createJoinIntent,
  createPool,
  executePayout,
  getPool,
  getPoolLeaderboard,
  getPayoutExecution,
  listMyPools,
  resolvePool,
  submitPoolTrades,
  type LeaderboardRow,
  type MyPoolSummary,
  type PoolSummary,
} from "@/lib/pools/api";
import { tip20Abi } from "@/lib/pools/tip20-abi";
import { PoolCreateSheet } from "@/components/pools/pool-create-sheet";
import { TxStatus, TxStatusBadge } from "@/components/pools/tx-status-badge";
import { cn } from "@/lib/utils";
import type { ResolvedBet } from "@/lib/game/types";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";
const explorerUrl = process.env.NEXT_PUBLIC_TEMPO_EXPLORER_URL ?? "https://explore.tempo.xyz";
const escrowAddress = process.env.NEXT_PUBLIC_OPERATOR_ESCROW_ADDRESS as `0x${string}` | undefined;
const tokenDecimals = Number(process.env.NEXT_PUBLIC_DEMO_TOKEN_DECIMALS ?? "6");

type SocialPoolsPanelProps = {
  onActivePoolChange?: (pool: PoolSummary | null) => void;
  onSelectPoolPlay: (pool: PoolSummary) => void;
  history: ResolvedBet[];
  currentUserAddress?: string;
};

type UserMeta = {
  userId: string;
  roles: string[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shortAddress(address?: string | null) {
  if (!address) return "Unknown";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatEventLabel(eventType: string) {
  switch (eventType) {
    case "pool.created":
      return "Pool created";
    case "pool.closed":
      return "Pool closed";
    case "participant.joined":
      return "Participant joined";
    case "pool.resolved":
      return "Winners confirmed";
    case "payout.executed":
      return "Payouts sent";
    default:
      return eventType;
  }
}

export function SocialPoolsPanel({ onActivePoolChange, onSelectPoolPlay, history, currentUserAddress }: SocialPoolsPanelProps) {
  const { authenticated, getAccessToken } = usePrivy();
  const { login } = useLogin();
  const { wallet } = useActiveWallet();

  const [poolIdInput, setPoolIdInput] = useState("");
  const [pool, setPool] = useState<PoolSummary | null>(null);
  const [myPools, setMyPools] = useState<MyPoolSummary[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [userMeta, setUserMeta] = useState<UserMeta | null>(null);
  const [status, setStatus] = useState<TxStatus>("idle");
  const [message, setMessage] = useState<string>("");
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const hydrated = useRef(false);
  const syncedTradeIdsRef = useRef<Set<string>>(new Set());

  const canUseWallet = authenticated && wallet?.type === "ethereum";

  const syncPool = useCallback(
    (next: PoolSummary | null) => {
      setPool(next);
      onActivePoolChange?.(next);
    },
    [onActivePoolChange],
  );

  const refreshMyPools = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const data = await listMyPools(token);
    setMyPools(data.pools);
  }, [getAccessToken]);

  const loadPool = useCallback(
    async (poolId: string) => {
      const token = await getAccessToken();
      if (!token || !poolId) return;

      const [poolData, leaderboardData] = await Promise.all([getPool(token, poolId), getPoolLeaderboard(token, poolId)]);
      setPoolIdInput(poolId);
      syncPool(poolData);
      setLeaderboard(leaderboardData.leaderboard);
    },
    [getAccessToken, syncPool],
  );

  useEffect(() => {
    if (!authenticated || hydrated.current) return;
    hydrated.current = true;

    const run = async () => {
      const token = await getAccessToken();
      if (!token) return;

      const verify = await fetch(`${backendUrl}/auth/privy/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: token }),
      });

      if (verify.ok) {
        const parsed = (await verify.json()) as { user?: { userId?: string; roles?: string[] } };
        if (parsed.user?.userId) {
          setUserMeta({ userId: parsed.user.userId, roles: parsed.user.roles ?? [] });
        }
      }

      await refreshMyPools();

      const fromUrl = new URLSearchParams(window.location.search).get("poolId");
      if (fromUrl) {
        await loadPool(fromUrl);
      }
    };

    void run();
  }, [authenticated, getAccessToken, loadPool, refreshMyPools]);

  const myParticipant = useMemo(() => {
    if (!pool || !currentUserAddress) return null;
    const normalized = currentUserAddress.toLowerCase();
    return (
      pool.participants?.find(
        (participant) => participant.walletAddress && participant.walletAddress.toLowerCase() === normalized,
      ) ?? null
    );
  }, [pool, currentUserAddress]);

  const joinedByMe = myParticipant?.joinStatus === "joined";

  useEffect(() => {
    if (pool && joinedByMe) {
      onSelectPoolPlay(pool);
    }
  }, [pool, joinedByMe, onSelectPoolPlay]);

  const canEndPool = Boolean(
    pool &&
      userMeta &&
      (pool.creatorUserId === userMeta.userId ||
        userMeta.roles.includes("admin") ||
        userMeta.roles.includes("operator")),
  );

  const poolHistory = useMemo(
    () => history.filter((bet) => pool?.id && bet.poolId === pool.id),
    [history, pool?.id],
  );

  useEffect(() => {
    syncedTradeIdsRef.current.clear();
  }, [pool?.id]);

  const eventRows = useMemo(() => {
    const rows = [...(pool?.events ?? [])].filter((event) => event.eventType !== "trades.synced");
    rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return rows;
  }, [pool?.events]);

  const handleCreate = async (payload: {
    title: string;
    entryAmount: string;
    tokenAddress: string;
    closeAt: string;
  }) => {
    const token = await getAccessToken();
    if (!token) return;

    const created = await createPool(token, { ...payload, resolveMode: "manual_admin" });
    setMessage(`Pool created: ${created.poolId}`);
    await loadPool(created.poolId);
    await refreshMyPools();
  };

  const handleJoinPool = async () => {
    if (!canUseWallet || !pool) return;
    const token = await getAccessToken();
    if (!token || !escrowAddress) return;

    setStatus("signing");
    setMessage("");

    const intent = await createJoinIntent(token, pool.id);
    const provider = await wallet.getEthereumProvider();
    const [address] = (await provider.request({ method: "eth_accounts" })) as string[];

    const data = encodeFunctionData({
      abi: tip20Abi,
      functionName: "transferWithMemo",
      args: [escrowAddress, parseUnits(intent.entryAmount, tokenDecimals), intent.memoHex],
    });

    const hash = (await provider.request({
      method: "eth_sendTransaction",
      params: [{ from: address, to: intent.tokenAddress, data }],
    })) as string;

    setStatus("submitted");
    setMessage(`Join submitted: ${hash}`);

    const maxAttempts = 20;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await confirmJoin(token, pool.id, {
          userAddress: address,
          joinTxHash: hash,
          memoHex: intent.memoHex,
        });
        break;
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error);
        const isPending = text.includes("transaction_not_found_or_unconfirmed");
        if (!isPending || attempt === maxAttempts) {
          throw error;
        }
        setStatus("confirming");
        setMessage(`Waiting confirmation... (${attempt}/${maxAttempts})`);
        await sleep(1200);
      }
    }

    setStatus("confirmed");
    setMessage("Join confirmed.");
    await loadPool(pool.id);
    await refreshMyPools();
  };

  useEffect(() => {
    if (!pool || !joinedByMe) return;
    if (pool.status === "paid") return;

    const unsynced = poolHistory.filter((bet) => !syncedTradeIdsRef.current.has(bet.id));
    if (unsynced.length === 0) return;

    const run = async () => {
      const token = await getAccessToken();
      if (!token) return;

      await submitPoolTrades(token, pool.id, {
        trades: unsynced.map((bet) => ({
          betId: bet.id,
          status: bet.status,
          stake: bet.stake.toFixed(8),
          payout: bet.payout.toFixed(8),
          resolvedAtTick: String(bet.resolvedAtTick),
        })),
      });

      for (const bet of unsynced) {
        syncedTradeIdsRef.current.add(bet.id);
      }

      const next = await getPoolLeaderboard(token, pool.id);
      setLeaderboard(next.leaderboard);
    };

    void run();
  }, [getAccessToken, joinedByMe, pool, poolHistory]);

  const handleEndPool = async () => {
    if (!pool) return;
    const token = await getAccessToken();
    if (!token) {
      setMessage("Auth token unavailable. Please re-login and try again.");
      return;
    }

    // Always refresh from backend first so auto-close sync is applied before we decide.
    const fresh = await getPool(token, pool.id);
    syncPool(fresh);

    if (fresh.status === "open") {
      setMessage("Pool is still open. Wait until close time to end it.");
      return;
    }

    if (fresh.status === "paid") {
      setMessage("Pool is already paid.");
      return;
    }

    setStatus("confirming");

    let latest = fresh;
    if (latest.status === "closed") {
      await resolvePool(token, pool.id, {
        outcome: { strategy: "trade_top_pnl" },
        reason: "Pool ended by admin creator",
      });
      latest = await getPool(token, pool.id);
    }

    if (latest.status === "resolved") {
      const executed = await executePayout(token, pool.id);
      const final = await getPayoutExecution(token, executed.executionId);
      setStatus(final.status === "failed" ? "failed" : final.status === "confirmed" ? "confirmed" : "confirming");
      setMessage(final.status === "confirmed" ? "Pool ended and winners paid." : "Payout finished with issues.");
      setShowWinnerModal(true);
    }

    await loadPool(pool.id);
    await refreshMyPools();
  };

  return (
    <div className="relative space-y-3">
      <div className={cn(!authenticated && "pointer-events-none select-none opacity-40")}>
        <div className="panel-section space-y-2">
          <p className="section-title">Open Pool</p>
          <Input
            value={poolIdInput}
            onChange={(e) => setPoolIdInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void loadPool(poolIdInput);
              }
            }}
            placeholder="Paste pool ID and press Enter"
          />
        </div>

        {!pool && (
          <div className="panel-section mt-3 space-y-3">
            <PoolCreateSheet onCreate={handleCreate} />

            {myPools.length > 0 && (
              <div className="space-y-2">
                <p className="section-title">My pools</p>
                {myPools.slice(0, 6).map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-md border border-border/75 bg-black/20 px-2.5 py-2 text-xs">
                    <div>
                      <p className="text-zinc-100">{item.title}</p>
                      <p className="muted-meta capitalize">{item.status}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => void loadPool(item.id)}>
                      Select
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {pool && (
          <div className="mt-3 space-y-3">
            <div className="panel-section text-xs">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-100">{pool.title}</p>
                <div className="flex items-center gap-2">
                  <TxStatusBadge status={status} />
                  <Badge variant="secondary" className="uppercase tracking-wide">
                    {pool.status}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-border/70 bg-black/20 p-2">
                  <p className="muted-meta">Entry</p>
                  <p className="text-zinc-100">${Number(pool.entryAmount).toFixed(2)}</p>
                </div>
                <div className="rounded-md border border-border/70 bg-black/20 p-2">
                  <p className="muted-meta">Participants</p>
                  <p className="text-zinc-100">{pool.participants?.filter((p) => p.joinStatus === "joined").length ?? 0}</p>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="gap-1" onClick={async () => {
                  await navigator.clipboard.writeText(pool.id);
                  setMessage("Pool ID copied.");
                }}>
                  <Copy className="h-3.5 w-3.5" />
                  Copy ID
                </Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={async () => {
                  const url = `${window.location.origin}${window.location.pathname}?poolId=${pool.id}`;
                  await navigator.clipboard.writeText(url);
                  setMessage("Pool link copied.");
                }}>
                  <Link2 className="h-3.5 w-3.5" />
                  Copy Link
                </Button>

                {!joinedByMe && pool.status === "open" && (
                  <Button size="sm" onClick={() => void handleJoinPool()}>
                    Join Pool
                  </Button>
                )}

                {joinedByMe && (
                  <Badge variant="default">Your trades are counted in this pool</Badge>
                )}

                {canEndPool && (
                  <Button size="sm" variant="outline" onClick={() => void handleEndPool()}>
                    End Pool
                  </Button>
                )}
              </div>
            </div>

            <div className="panel-section text-xs">
              <p className="section-title mb-2">Participants</p>
              <div className="space-y-1">
                {(pool.participants ?? []).map((participant) => {
                  const mine =
                    currentUserAddress &&
                    participant.walletAddress &&
                    participant.walletAddress.toLowerCase() === currentUserAddress.toLowerCase();
                  return (
                    <div key={participant.id} className="flex items-center justify-between rounded-md border border-border/70 bg-black/20 px-2 py-1">
                      <span className={mine ? "text-blue-300" : "text-zinc-200"}>
                        {shortAddress(participant.walletAddress)}{mine ? " (you)" : ""}
                      </span>
                      <span className="muted-meta">{participant.joinStatus}</span>
                    </div>
                  );
                })}
                {(pool.participants ?? []).length === 0 && <p className="muted-meta">No participants yet.</p>}
              </div>
            </div>

            <div className="panel-section text-xs">
              <p className="section-title mb-2">Leaderboard</p>
              {leaderboard.length === 0 && <p className="muted-meta">No synced pool trades yet.</p>}
              {leaderboard.length > 0 && (
                <div className="mb-1 grid grid-cols-[1fr_74px] gap-2 px-2 text-[10px] uppercase tracking-wide text-zinc-500">
                  <span>Address</span>
                  <span className="text-right">Net PnL</span>
                </div>
              )}
              <div className="space-y-1">
                {leaderboard.map((row) => {
                  const mine =
                    currentUserAddress &&
                    row.walletAddress &&
                    row.walletAddress.toLowerCase() === currentUserAddress.toLowerCase();
                  return (
                    <div
                      key={row.participantId}
                      className={cn(
                        "grid grid-cols-[1fr_74px] items-center gap-2 rounded-md border border-border/70 bg-black/20 px-2 py-1",
                        mine && "border-primary/35 bg-primary/10",
                      )}
                    >
                      <span className="text-zinc-200">{shortAddress(row.walletAddress)}{mine ? " (you)" : ""}</span>
                      <span className={cn("text-right", row.pnl && Number(row.pnl) >= 0 ? "value-positive" : "value-negative")}>
                        {row.pnl ? `${Number(row.pnl) >= 0 ? "+" : ""}${Number(row.pnl).toFixed(2)}` : "--"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="panel-section text-xs">
              <p className="section-title mb-2">History</p>
              {eventRows.length === 0 && <p className="muted-meta">No events yet.</p>}
              <div className="space-y-2">
                {eventRows.map((event) => {
                  const txHash = (event.payloadJson?.txHash as string | undefined) ?? undefined;
                  const txHashes = Array.isArray(event.payloadJson?.txHashes) ? (event.payloadJson?.txHashes as string[]) : [];

                  return (
                    <div key={event.id} className="rounded-md border border-border/70 bg-black/20 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-zinc-200">{formatEventLabel(event.eventType)}</p>
                        <p className="muted-meta">{new Date(event.createdAt).toLocaleString()}</p>
                      </div>
                      {txHash && (
                        <a href={`${explorerUrl}/tx/${txHash}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-primary">
                          View tx
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {txHashes.map((hash) => (
                        <a key={hash} href={`${explorerUrl}/tx/${hash}`} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-primary">
                          {hash.slice(0, 10)}...
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {message && <p className="mt-3 rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-xs text-blue-200 break-all">{message}</p>}
      </div>

      {!authenticated && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-background/75 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-sm font-semibold text-foreground">Login to use Pulsar Predict Pools</p>
            <p className="mt-1 text-xs text-muted-foreground">Join a pool and your trades will be tracked automatically.</p>
            <Button className="mt-3 w-full" onClick={() => login()}>
              Login with Privy
            </Button>
          </div>
        </div>
      )}

      {showWinnerModal && pool && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
          <div className="panel-shell w-full max-w-lg p-4">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="text-lg font-semibold text-zinc-100">Pool Settled</p>
                <p className="muted-meta">Payouts for {pool.title}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowWinnerModal(false)}>
                Close
              </Button>
            </div>

            <div className="space-y-2 text-xs">
              {(pool.payouts ?? []).map((payout) => {
                const participant = pool.participants?.find((item) => item.id === payout.participantId);
                return (
                  <div key={payout.id} className="rounded-md border border-border/70 bg-black/20 p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-200">{shortAddress(participant?.walletAddress)}</span>
                      <span className="text-zinc-300">${Number(payout.amount).toFixed(2)}</span>
                    </div>
                    {payout.txHash && (
                      <a href={`${explorerUrl}/tx/${payout.txHash}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-primary">
                        View payout tx
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
