"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useActiveWallet, useLogin, usePrivy } from "@privy-io/react-auth";
import { encodeFunctionData, parseUnits } from "viem";
import { ChevronDown, ChevronUp, Copy, ExternalLink, Link2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  submitPoolScore,
  type LeaderboardRow,
  type MyPoolSummary,
  type PoolSummary,
} from "@/lib/pools/api";
import { tip20Abi } from "@/lib/pools/tip20-abi";
import { PoolCreateSheet } from "@/components/pools/pool-create-sheet";
import { TxStatus, TxStatusBadge } from "@/components/pools/tx-status-badge";
import { cn } from "@/lib/utils";
import type { ResolvedBet } from "@/lib/game/types";

const explorerUrl = process.env.NEXT_PUBLIC_TEMPO_EXPLORER_URL ?? "https://explore.tempo.xyz";
const escrowAddress = process.env.NEXT_PUBLIC_OPERATOR_ESCROW_ADDRESS as `0x${string}` | undefined;
const tokenDecimals = Number(process.env.NEXT_PUBLIC_DEMO_TOKEN_DECIMALS ?? "6");

type SocialPoolsPanelProps = {
  onActivePoolChange?: (pool: PoolSummary | null) => void;
  activePlayMode: "demo" | "pool";
  activePoolId: string | null;
  onSelectPoolPlay: (pool: PoolSummary) => void;
  onSelectDemoPlay: () => void;
  history: ResolvedBet[];
  currentUserAddress?: string;
};

type StepState = "todo" | "ready" | "done" | "blocked";

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
    case "score.submitted":
      return "Score submitted";
    case "pool.resolved":
      return "Winners confirmed";
    case "payout.executed":
      return "Payouts sent";
    default:
      return eventType;
  }
}

function StepChip({ state }: { state: StepState }) {
  const style =
    state === "done"
      ? "bg-success/20 text-success border-success/40"
      : state === "ready"
        ? "bg-primary/20 text-primary border-primary/40"
        : state === "blocked"
          ? "bg-warning/20 text-warning border-warning/40"
          : "bg-zinc-800 text-zinc-400 border-zinc-700";

  return <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase", style)}>{state}</span>;
}

export function SocialPoolsPanel({
  onActivePoolChange,
  activePlayMode,
  activePoolId,
  onSelectPoolPlay,
  onSelectDemoPlay,
  history,
  currentUserAddress,
}: SocialPoolsPanelProps) {
  const { authenticated, getAccessToken } = usePrivy();
  const { login } = useLogin();
  const { wallet } = useActiveWallet();

  const [poolIdInput, setPoolIdInput] = useState("");
  const [pool, setPool] = useState<PoolSummary | null>(null);
  const [myPools, setMyPools] = useState<MyPoolSummary[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState("active");
  const [status, setStatus] = useState<TxStatus>("idle");
  const [message, setMessage] = useState<string>("");
  const [txHashes, setTxHashes] = useState<string[]>([]);
  const [failures, setFailures] = useState<Array<{ payoutId: string; reason: string }>>([]);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [sharedPoolIds, setSharedPoolIds] = useState<string[]>([]);

  const canUse = authenticated && wallet?.type === "ethereum";

  const syncPool = useCallback((next: PoolSummary | null) => {
    setPool(next);
    onActivePoolChange?.(next);
  }, [onActivePoolChange]);

  const refreshMyPools = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const data = await listMyPools(token);
    setMyPools(data.pools);
  }, [getAccessToken]);

  const refreshPool = useCallback(async (nextPoolId?: string) => {
    const token = await getAccessToken();
    const id = nextPoolId ?? pool?.id;
    if (!token || !id) return;

    const [poolData, leaderboardData] = await Promise.all([getPool(token, id), getPoolLeaderboard(token, id)]);
    syncPool(poolData);
    setLeaderboard(leaderboardData.leaderboard);
  }, [getAccessToken, pool?.id, syncPool]);

  const openPoolById = async (id: string) => {
    setPoolIdInput(id);
    setStatus("idle");
    setMessage("");
    await refreshPool(id);
    setTab("active");
  };

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    const fromUrl = new URLSearchParams(window.location.search).get("poolId");
    void refreshMyPools();

    if (fromUrl) {
      setPoolIdInput(fromUrl);
      void refreshPool(fromUrl);
      return;
    }

    if (poolIdInput) {
      void refreshPool(poolIdInput);
    }
  }, [authenticated, poolIdInput, refreshMyPools, refreshPool]);

  const handleCreate = async (payload: {
    title: string;
    entryAmount: string;
    tokenAddress: string;
    closeAt: string;
  }) => {
    const token = await getAccessToken();
    if (!token) return;

    const created = await createPool(token, {
      ...payload,
      resolveMode: "manual_admin",
    });

    setMessage(`Pool created: ${created.poolId}`);
    await openPoolById(created.poolId);
    await refreshMyPools();
  };

  const loadPool = async () => {
    if (!poolIdInput) return;
    await openPoolById(poolIdInput);
  };

  const joinPool = async () => {
    if (!canUse || !pool) return;
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
      params: [
        {
          from: address,
          to: intent.tokenAddress,
          data,
        },
      ],
    })) as string;

    setStatus("submitted");
    setMessage(`Join submitted: ${hash}`);

    const maxAttempts = 20;
    const retryDelayMs = 1500;

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
        const isLastAttempt = attempt === maxAttempts;

        if (!isPending || isLastAttempt) {
          throw error;
        }

        setStatus("confirming");
        setMessage(`Waiting confirmation... (${attempt}/${maxAttempts})`);
        await sleep(retryDelayMs);
      }
    }

    setStatus("confirmed");
    setMessage(`Join confirmed: ${hash}`);
    await refreshPool(pool.id);
    await refreshMyPools();
  };

  const resolveCurrentPool = async () => {
    if (!pool) return;
    const token = await getAccessToken();
    if (!token) return;

    await resolvePool(token, pool.id, {
      outcome: { strategy: "score_top_pnl" },
      reason: "Manual winner confirmation",
    });

    setMessage("Winners confirmed. Next step: Send payouts.");
    await refreshPool(pool.id);
    await refreshMyPools();
  };

  const executeCurrentPayout = async () => {
    if (!pool) return;
    const token = await getAccessToken();
    if (!token) return;

    setStatus("confirming");

    const executed = await executePayout(token, pool.id);
    setTxHashes(executed.txHashes);
    setFailures(executed.failures);

    const final = await getPayoutExecution(token, executed.executionId);
    setTxHashes(final.txHashes);
    setFailures(final.failures);

    const finalStatus: TxStatus =
      final.status === "failed" ? "failed" : final.status === "confirmed" ? "confirmed" : "confirming";

    setStatus(finalStatus);
    setMessage(finalStatus === "confirmed" ? "Pool settled and payouts sent." : "Payout execution finished with issues.");

    await refreshPool(pool.id);
    await refreshMyPools();
    setShowWinnerModal(true);
  };

  const submitScoreForActivePool = async () => {
    if (!pool) return;
    const token = await getAccessToken();
    if (!token) return;

    await submitPoolScore(token, pool.id, {
      pnl: scorePreview.pnl.toFixed(8),
      totalStake: scorePreview.totalStake.toFixed(8),
      totalPayout: scorePreview.totalPayout.toFixed(8),
      wins: scorePreview.wins,
      losses: scorePreview.losses,
    });

    setMessage("Score submitted. Leaderboard updated.");
    await refreshPool(pool.id);
  };

  const copyPoolId = async () => {
    if (!pool?.id) return;
    await navigator.clipboard.writeText(pool.id);
    setMessage("Pool ID copied.");
    setSharedPoolIds((prev) => (prev.includes(pool.id) ? prev : [...prev, pool.id]));
  };

  const sharePoolLink = async () => {
    if (!pool?.id) return;
    const url = `${window.location.origin}${window.location.pathname}?poolId=${pool.id}`;
    await navigator.clipboard.writeText(url);
    setMessage("Share link copied.");
    setSharedPoolIds((prev) => (prev.includes(pool.id) ? prev : [...prev, pool.id]));
  };

  const isPlayingThisPool = Boolean(pool?.id && activePlayMode === "pool" && activePoolId === pool.id);

  const myParticipant = useMemo(() => {
    if (!pool || !currentUserAddress) {
      return null;
    }
    const normalized = currentUserAddress.toLowerCase();
    return (
      pool.participants?.find(
        (participant) => participant.walletAddress && participant.walletAddress.toLowerCase() === normalized,
      ) ?? null
    );
  }, [pool, currentUserAddress]);

  const joinedByMe = myParticipant?.joinStatus === "joined";

  const poolHistory = useMemo(
    () => history.filter((bet) => pool?.id && bet.poolId === pool.id),
    [history, pool?.id],
  );

  const scorePreview = useMemo(() => {
    const wins = poolHistory.filter((bet) => bet.status === "won").length;
    const losses = poolHistory.filter((bet) => bet.status !== "won").length;
    const totalStake = poolHistory.reduce((acc, bet) => acc + bet.stake, 0);
    const totalPayout = poolHistory.reduce((acc, bet) => acc + bet.payout, 0);

    return {
      trades: poolHistory.length,
      wins,
      losses,
      totalStake,
      totalPayout,
      pnl: totalPayout - totalStake,
    };
  }, [poolHistory]);

  const groupedPools = useMemo(() => {
    const groups: Record<"open" | "closed" | "resolved" | "paid", MyPoolSummary[]> = {
      open: [],
      closed: [],
      resolved: [],
      paid: [],
    };

    for (const item of myPools) {
      groups[item.status]?.push(item);
    }

    return groups;
  }, [myPools]);

  const stepStates = useMemo(() => {
    const hasPool = Boolean(pool);
    const poolClosed = pool?.status === "closed";
    const poolResolved = pool?.status === "resolved" || pool?.status === "paid";
    const poolPaid = pool?.status === "paid";
    const scoreSubmitted = Boolean(pool?.myScoreSubmitted);
    const shared = Boolean(pool?.id && sharedPoolIds.includes(pool.id));

    return [
      { label: "Create or load pool", state: hasPool ? "done" : "ready" as StepState },
      {
        label: "Share pool ID",
        state: !hasPool ? "blocked" : shared ? "done" : "ready" as StepState,
      },
      {
        label: "Join pool (onchain)",
        state: !hasPool ? "blocked" : joinedByMe ? "done" : pool?.status === "open" ? "ready" : "blocked" as StepState,
      },
      {
        label: "Switch to pool play",
        state: !hasPool || !joinedByMe ? "blocked" : isPlayingThisPool ? "done" : "ready" as StepState,
      },
      {
        label: "Submit my score",
        state: !hasPool || !joinedByMe
          ? "blocked"
          : scoreSubmitted
            ? "done"
            : poolClosed || poolResolved
              ? "ready"
              : "todo" as StepState,
      },
      {
        label: "Pick/Confirm winners",
        state: !hasPool ? "blocked" : poolResolved ? "done" : poolClosed ? "ready" : "todo" as StepState,
      },
      {
        label: "Send payouts",
        state: !hasPool ? "blocked" : poolPaid ? "done" : pool?.status === "resolved" ? "ready" : "todo" as StepState,
      },
    ];
  }, [pool, joinedByMe, isPlayingThisPool, sharedPoolIds]);

  const eventRows = useMemo(() => {
    const rows = [...(pool?.events ?? [])];
    rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return rows;
  }, [pool?.events]);

  const outcome = pool?.outcomes?.[pool.outcomes.length - 1] as
    | { outcomeJson?: { rankingSnapshot?: Array<{ participantId: string; rank: number | null; pnl: string | null }>; winnerPrivyDids?: string[] } }
    | undefined;

  const participantById = useMemo(() => {
    const map = new Map<string, { walletAddress: string | null }>();
    for (const participant of pool?.participants ?? []) {
      map.set(participant.id, { walletAddress: participant.walletAddress });
    }
    return map;
  }, [pool?.participants]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base text-zinc-100">Pulsar Predict Pools</CardTitle>
            <p className="text-xs text-zinc-400">One clear flow: create, share, join, play, submit score, confirm winners, send payouts.</p>
          </div>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setCollapsed((v) => !v)}>
            {collapsed ? (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Expand
              </>
            ) : (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Collapse
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="relative space-y-3">
          <div className={cn(!authenticated && "pointer-events-none select-none opacity-40")}>
            <Tabs value={tab} onValueChange={setTab} className="space-y-3">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="my-pools">My Pools</TabsTrigger>
                <TabsTrigger value="active">Active Pool</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              <TabsContent value="my-pools" className="space-y-3">
                <PoolCreateSheet onCreate={handleCreate} />

                {([
                  ["Open", groupedPools.open],
                  ["Closed", groupedPools.closed],
                  ["Resolved", groupedPools.resolved],
                  ["Paid", groupedPools.paid],
                ] as const).map(([label, rows]) => (
                  <div key={label} className="space-y-2 rounded-md border border-border bg-zinc-900/40 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-zinc-200">{label}</p>
                      <Badge variant="secondary">{rows.length}</Badge>
                    </div>

                    {rows.length === 0 && <p className="text-xs text-zinc-500">No pools in this status.</p>}

                    {rows.map((row) => (
                      <div key={row.id} className="rounded-md border border-zinc-800 bg-zinc-950/60 p-2 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-zinc-100">{row.title}</p>
                            <p className="text-zinc-400">
                              Entry ${Number(row.entryAmount).toFixed(2)} · {row.participantCount} participants
                            </p>
                          </div>
                          <Badge variant="secondary" className="uppercase">
                            {row.status}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <Button size="sm" variant="outline" onClick={() => void openPoolById(row.id)}>
                            Open
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={async () => {
                              await navigator.clipboard.writeText(row.id);
                              setMessage("Pool ID copied.");
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copy ID
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="active" className="space-y-3">
                <div className="rounded-md border border-border bg-zinc-900/40 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-zinc-200">Active Pool</p>
                    <TxStatusBadge status={status} />
                  </div>
                  <div className="flex gap-2">
                    <Input value={poolIdInput} onChange={(e) => setPoolIdInput(e.target.value)} placeholder="Paste pool ID to open" />
                    <Button variant="outline" onClick={() => void loadPool()}>
                      Open
                    </Button>
                  </div>
                  {pool?.id && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => void copyPoolId()} className="gap-1">
                        <Copy className="h-3.5 w-3.5" />
                        Copy ID
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void sharePoolLink()} className="gap-1">
                        <Link2 className="h-3.5 w-3.5" />
                        Copy Link
                      </Button>
                    </div>
                  )}
                </div>

                {!pool && (
                  <p className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-500">
                    Create a pool in My Pools, then open it here to run the full lifecycle.
                  </p>
                )}

                {pool && (
                  <>
                    <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-medium text-zinc-100">{pool.title}</p>
                        <Badge variant="secondary" className="uppercase">
                          {pool.status}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        {stepStates.map((step) => (
                          <div key={step.label} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950/60 px-2 py-1.5 text-xs">
                            <span className="text-zinc-200">{step.label}</span>
                            <StepChip state={step.state} />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button onClick={() => void joinPool()} disabled={!canUse || pool.status !== "open"}>
                        Join Pool
                      </Button>
                      <Button
                        variant={isPlayingThisPool ? "default" : "outline"}
                        onClick={() => {
                          if (!joinedByMe) {
                            setMessage("Join this pool first, then enable Pool Play.");
                            return;
                          }
                          onSelectPoolPlay(pool);
                        }}
                        disabled={!joinedByMe}
                      >
                        {isPlayingThisPool ? "Pool Play Active" : "Enable Pool Play"}
                      </Button>
                      <Button variant="outline" onClick={onSelectDemoPlay}>
                        Switch To Demo
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => void submitScoreForActivePool()}
                        disabled={!joinedByMe || (pool.status !== "closed" && pool.status !== "resolved") || pool.myScoreSubmitted}
                      >
                        {pool.myScoreSubmitted ? "Score Submitted" : "Submit My Score"}
                      </Button>
                      <Button variant="outline" onClick={() => void resolveCurrentPool()} disabled={pool.status !== "closed"}>
                        Pick/Confirm Winners
                      </Button>
                      <Button variant="outline" onClick={() => void executeCurrentPayout()} disabled={pool.status !== "resolved"}>
                        Send Payouts
                      </Button>
                    </div>

                    <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-xs">
                      <p className="mb-2 font-medium text-zinc-200">My Score Preview</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded bg-zinc-950/60 p-2">
                          <p className="text-zinc-500">Trades</p>
                          <p className="text-zinc-100">{scorePreview.trades}</p>
                        </div>
                        <div className="rounded bg-zinc-950/60 p-2">
                          <p className="text-zinc-500">Wins/Losses</p>
                          <p className="text-zinc-100">{scorePreview.wins}/{scorePreview.losses}</p>
                        </div>
                        <div className="rounded bg-zinc-950/60 p-2">
                          <p className="text-zinc-500">Net PnL</p>
                          <p className={scorePreview.pnl >= 0 ? "text-success" : "text-[#EF4444]"}>
                            {scorePreview.pnl >= 0 ? "+" : ""}${scorePreview.pnl.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <p className="mt-2 text-zinc-500">Only submitted scores count for winner selection.</p>
                    </div>

                    <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-xs">
                      <p className="mb-2 font-medium text-zinc-200">Leaderboard</p>
                      {leaderboard.length === 0 && <p className="text-zinc-500">No joined participants yet.</p>}
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
                                "grid grid-cols-[34px_1fr_60px_72px] items-center gap-2 rounded border border-zinc-800 px-2 py-1",
                                mine && "border-primary/40 bg-primary/10",
                              )}
                            >
                              <span className="text-zinc-400">{row.rank ?? "-"}</span>
                              <span className="text-zinc-200">{shortAddress(row.walletAddress)}{mine ? " (you)" : ""}</span>
                              <span className="text-zinc-400">{row.submitted ? "Submitted" : "Pending"}</span>
                              <span className={row.pnl && Number(row.pnl) >= 0 ? "text-success" : "text-[#EF4444]"}>
                                {row.pnl ? `${Number(row.pnl) >= 0 ? "+" : ""}${Number(row.pnl).toFixed(2)}` : "--"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <details className="rounded-md border border-border bg-zinc-900/40">
                      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm text-zinc-300">
                        Technical Details
                        <ChevronDown className="h-4 w-4" />
                      </summary>
                      <div className="space-y-1 px-3 pb-3 text-xs text-zinc-500">
                        <p>Pool ID: {pool.id}</p>
                        <p>Entry amount: {pool.entryAmount}</p>
                        <p>Token: {pool.tokenAddress}</p>
                        {txHashes.length > 0 && <p>Payout tx count: {txHashes.length}</p>}
                      </div>
                    </details>
                  </>
                )}
              </TabsContent>

              <TabsContent value="history" className="space-y-2">
                {!pool && <p className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-500">Open a pool to view timeline and transaction history.</p>}

                {pool && eventRows.length === 0 && (
                  <p className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-500">No events yet.</p>
                )}

                {pool &&
                  eventRows.map((event) => {
                    const txHash = (event.payloadJson?.txHash as string | undefined) ?? undefined;
                    const txHashesFromPayload = Array.isArray(event.payloadJson?.txHashes)
                      ? (event.payloadJson?.txHashes as string[])
                      : [];

                    return (
                      <div key={event.id} className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-zinc-200">{formatEventLabel(event.eventType)}</p>
                          <span className="text-zinc-500">{new Date(event.createdAt).toLocaleString()}</span>
                        </div>
                        {txHash && (
                          <a
                            href={`${explorerUrl}/tx/${txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-primary"
                          >
                            View tx
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {txHashesFromPayload.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {txHashesFromPayload.map((hash) => (
                              <a
                                key={hash}
                                href={`${explorerUrl}/tx/${hash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-primary"
                              >
                                {hash.slice(0, 10)}...
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </TabsContent>
            </Tabs>

            {message && <p className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-xs text-blue-200 break-all">{message}</p>}
          </div>

          {!authenticated && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-background/75 backdrop-blur-sm">
              <div className="mx-4 w-full max-w-sm rounded-lg border border-border bg-card p-4 text-center">
                <p className="text-sm font-semibold text-foreground">Login to use Pulsar Predict</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create pools, join onchain, submit score, and settle winners from one place.
                </p>
                <Button className="mt-3 w-full" onClick={() => login()}>
                  Login with Privy
                </Button>
              </div>
            </div>
          )}

          {showWinnerModal && pool && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-950 p-4">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <p className="text-lg font-semibold text-zinc-100">Pool Settled</p>
                    <p className="text-xs text-zinc-400">Payout results for {pool.title}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setShowWinnerModal(false)}>
                    Close
                  </Button>
                </div>

                <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded border border-zinc-800 bg-zinc-900/60 p-2">
                    <p className="text-zinc-500">Total paid tx</p>
                    <p className="text-zinc-100">{pool.payouts?.filter((item) => item.txHash).length ?? 0}</p>
                  </div>
                  <div className="rounded border border-zinc-800 bg-zinc-900/60 p-2">
                    <p className="text-zinc-500">Failed payouts</p>
                    <p className="text-zinc-100">{failures.length}</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  {(pool.payouts ?? []).map((payout) => {
                    const participant = participantById.get(payout.participantId);
                    return (
                      <div key={payout.id} className="rounded border border-zinc-800 bg-zinc-900/60 p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-200">{shortAddress(participant?.walletAddress)}</span>
                          <span className="text-zinc-400">${Number(payout.amount).toFixed(2)}</span>
                        </div>
                        {payout.txHash ? (
                          <a
                            href={`${explorerUrl}/tx/${payout.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-primary"
                          >
                            View payout tx
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <p className="mt-1 text-[#EF4444]">No tx hash (failed/unconfirmed)</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {outcome?.outcomeJson?.rankingSnapshot && (
                  <div className="mt-3 rounded border border-zinc-800 bg-zinc-900/50 p-2 text-xs">
                    <p className="mb-1 text-zinc-400">Winner ranking snapshot</p>
                    <p className="text-zinc-500">Top net PnL at resolve-time determined winners.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
