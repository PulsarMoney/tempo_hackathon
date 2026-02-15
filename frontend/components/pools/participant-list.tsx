"use client";

type Participant = {
  id: string;
  joinStatus: string;
  walletAddress: string | null;
  joinTxHash: string | null;
};

export function ParticipantList({ participants, explorerUrl }: { participants: Participant[]; explorerUrl: string }) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-zinc-900/40 p-2">
      <h4 className="text-xs font-semibold text-zinc-300">Participants</h4>
      <div className="max-h-36 space-y-1 overflow-auto text-xs">
        {participants.length === 0 && <p className="text-zinc-500">No participants yet.</p>}
        {participants.map((participant) => (
          <div key={participant.id} className="rounded border border-zinc-800 px-2 py-1">
            <div className="flex items-center justify-between">
              <span className="text-zinc-300">{participant.id.slice(0, 8)}...</span>
              <span className="text-zinc-400">{participant.joinStatus}</span>
            </div>
            <div className="text-zinc-500">{participant.walletAddress ?? "no wallet"}</div>
            {participant.joinTxHash && (
              <a
                className="text-primary underline"
                href={`${explorerUrl}/tx/${participant.joinTxHash}`}
                target="_blank"
                rel="noreferrer"
              >
                join tx
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
