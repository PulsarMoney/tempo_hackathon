"use client";

import { TxStatusBadge, type TxStatus } from "@/components/pools/tx-status-badge";

type PayoutExecutionPanelProps = {
  status: TxStatus;
  txHashes: string[];
  failures: Array<{ payoutId: string; reason: string }>;
  explorerUrl: string;
};

export function PayoutExecutionPanel({ status, txHashes, failures, explorerUrl }: PayoutExecutionPanelProps) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-zinc-900/40 p-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-zinc-300">Payout execution</h4>
        <TxStatusBadge status={status} />
      </div>

      {txHashes.length > 0 && (
        <div className="space-y-1 text-xs">
          {txHashes.map((txHash) => (
            <a key={txHash} className="block text-primary underline" href={`${explorerUrl}/tx/${txHash}`} target="_blank" rel="noreferrer">
              {txHash.slice(0, 12)}...
            </a>
          ))}
        </div>
      )}

      {failures.length > 0 && (
        <div className="space-y-1 text-xs text-red-300">
          {failures.map((failure) => (
            <p key={failure.payoutId}>{failure.payoutId.slice(0, 8)}...: {failure.reason}</p>
          ))}
        </div>
      )}
    </div>
  );
}
