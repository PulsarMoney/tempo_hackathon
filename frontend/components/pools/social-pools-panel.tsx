"use client";

import { useMemo, useState } from "react";
import { useActiveWallet, useLogin, usePrivy } from "@privy-io/react-auth";
import { encodeFunctionData, parseUnits } from "viem";
import { ChevronDown } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  confirmJoin,
  createJoinIntent,
  createPool,
  executePayout,
  getPool,
  getPayoutExecution,
  resolvePool,
  type PoolSummary,
} from "@/lib/pools/api";
import { tip20Abi } from "@/lib/pools/tip20-abi";
import { PoolCreateSheet } from "@/components/pools/pool-create-sheet";
import { PoolDetailPanel } from "@/components/pools/pool-detail-panel";
import { ParticipantList } from "@/components/pools/participant-list";
import { PayoutExecutionPanel } from "@/components/pools/payout-execution-panel";
import { TxStatus, TxStatusBadge } from "@/components/pools/tx-status-badge";
import { cn } from "@/lib/utils";

const explorerUrl = process.env.NEXT_PUBLIC_TEMPO_EXPLORER_URL ?? "https://explore.tempo.xyz";
const escrowAddress = process.env.NEXT_PUBLIC_OPERATOR_ESCROW_ADDRESS as `0x${string}` | undefined;
const tokenDecimals = Number(process.env.NEXT_PUBLIC_DEMO_TOKEN_DECIMALS ?? "6");

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function SocialPoolsPanel() {
  const { authenticated, getAccessToken } = usePrivy();
  const { login } = useLogin();
  const { wallet } = useActiveWallet();

  const [poolId, setPoolId] = useState("");
  const [pool, setPool] = useState<PoolSummary | null>(null);
  const [status, setStatus] = useState<TxStatus>("idle");
  const [message, setMessage] = useState<string>("");
  const [txHashes, setTxHashes] = useState<string[]>([]);
  const [failures, setFailures] = useState<Array<{ payoutId: string; reason: string }>>([]);

  const canUse = authenticated && wallet?.type === "ethereum";

  const loadPool = async () => {
    const token = await getAccessToken();
    if (!token || !poolId) return;
    const data = await getPool(token, poolId);
    setPool(data);
  };

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
    setPoolId(created.poolId);
    setMessage(`Pool created: ${created.poolId}`);
    await loadPool();
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
    setMessage(`Tx submitted, waiting confirmation: ${hash}`);

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
        setMessage(`Waiting for chain confirmation... (${attempt}/${maxAttempts})`);
        await sleep(retryDelayMs);
      }
    }

    setStatus("confirmed");
    setMessage(`Join confirmed: ${hash}`);
    await loadPool();
  };

  const resolveCurrentPool = async () => {
    if (!pool) return;
    const token = await getAccessToken();
    if (!token) return;
    await resolvePool(token, pool.id, {
      outcome: { strategy: "equal_split_if_no_winners" },
      reason: "Manual admin resolve (MVP)",
    });
    setMessage("Pool resolved");
    await loadPool();
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
    setStatus(final.status === "failed" ? "failed" : final.status === "confirmed" ? "confirmed" : "confirming");

    await loadPool();
  };

  const currentPool = useMemo(
    () =>
      pool
        ? {
            id: pool.id,
            title: pool.title,
            status: pool.status,
            entryAmount: pool.entryAmount,
            tokenAddress: pool.tokenAddress,
          }
        : null,
    [pool],
  );

  return (
    <Card>
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="text-base text-zinc-100">Pulsar Predict Pools</CardTitle>
        <p className="text-xs text-zinc-400">Simple flow: create a pool, join with one payment, then resolve and pay winners.</p>
      </CardHeader>
      <CardContent className="relative space-y-3">
        <div className={cn(!authenticated && "pointer-events-none select-none opacity-40")}>
          <PoolCreateSheet onCreate={handleCreate} />

          <div className="rounded-md border border-border bg-zinc-900/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-200">Active Pool</p>
              <TxStatusBadge status={status} />
            </div>
            <div className="flex gap-2">
              <Input value={poolId} onChange={(e) => setPoolId(e.target.value)} placeholder="Paste pool ID to open existing pool" />
              <Button variant="outline" onClick={loadPool}>
                Open
              </Button>
            </div>
          </div>

          <PoolDetailPanel pool={currentPool} onJoin={joinPool} onResolve={resolveCurrentPool} onExecutePayout={executeCurrentPayout} />

          <Separator />
          <ParticipantList participants={pool?.participants ?? []} explorerUrl={explorerUrl} />

          <details className="rounded-md border border-border bg-zinc-900/40">
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm text-zinc-300">
              Technical Details
              <ChevronDown className="h-4 w-4" />
            </summary>
            <div className="space-y-2 px-3 pb-3">
              <PayoutExecutionPanel status={status} txHashes={txHashes} failures={failures} explorerUrl={explorerUrl} />
            </div>
          </details>

          {message && <p className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-xs text-blue-200 break-all">{message}</p>}
        </div>

        {!authenticated && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-background/75 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-sm rounded-lg border border-border bg-card p-4 text-center">
              <p className="text-sm font-semibold text-foreground">Login to use Pulsar Predict</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create pools, join with one payment, and track results after signing in.
              </p>
              <Button className="mt-3 w-full" onClick={() => login()}>
                Login with Privy
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
