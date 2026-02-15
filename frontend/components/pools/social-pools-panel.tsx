"use client";

import { useMemo, useState } from "react";
import { useActiveWallet, usePrivy } from "@privy-io/react-auth";
import { encodeFunctionData, parseUnits } from "viem";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

const explorerUrl = process.env.NEXT_PUBLIC_TEMPO_EXPLORER_URL ?? "https://explore.tempo.xyz";
const escrowAddress = process.env.NEXT_PUBLIC_OPERATOR_ESCROW_ADDRESS as `0x${string}` | undefined;
const tokenDecimals = Number(process.env.NEXT_PUBLIC_DEMO_TOKEN_DECIMALS ?? "6");

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function SocialPoolsPanel() {
  const { authenticated, getAccessToken } = usePrivy();
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
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-zinc-300">Social Pools (Tempo)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <PoolCreateSheet onCreate={handleCreate} />

        <div className="flex gap-2">
          <Input value={poolId} onChange={(e) => setPoolId(e.target.value)} placeholder="Pool ID" />
          <Button variant="outline" onClick={loadPool}>
            Load
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-md border border-border bg-zinc-900/40 px-2 py-1 text-xs">
          <span className="text-zinc-400">Join/Payout status</span>
          <TxStatusBadge status={status} />
        </div>

        {!canUse && <p className="text-xs text-amber-300">Login with Privy and connect an EVM wallet to use pool actions.</p>}

        <PoolDetailPanel pool={currentPool} onJoin={joinPool} onResolve={resolveCurrentPool} onExecutePayout={executeCurrentPayout} />

        <ParticipantList participants={pool?.participants ?? []} explorerUrl={explorerUrl} />

        <PayoutExecutionPanel status={status} txHashes={txHashes} failures={failures} explorerUrl={explorerUrl} />

        {message && <p className="text-xs text-blue-300 break-all">{message}</p>}
      </CardContent>
    </Card>
  );
}
