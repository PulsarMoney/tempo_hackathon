"use client";

type Participant = {
  id: string;
  joinStatus: string;
  walletAddress: string | null;
  joinTxHash: string | null;
};

export function ParticipantList({ participants, explorerUrl }: { participants: Participant[]; explorerUrl: string }) {
  const joinedCount = participants.filter((participant) => participant.joinStatus === "joined").length;

  return (
    <div className="space-y-2 rounded-md border border-border bg-zinc-900/40 p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-zinc-200">Participants</h4>
        <span className="text-xs text-zinc-400">
          {joinedCount}/{participants.length} joined
        </span>
      </div>
      <div className="max-h-36 space-y-1 overflow-auto text-xs">
        {participants.length === 0 && <p className="text-zinc-500">No participants yet.</p>}
        {participants.map((participant) => (
          <div key={participant.id} className="rounded border border-zinc-800 px-2 py-1">
            <div className="flex items-center justify-between">
              <span className="text-zinc-300">{participant.walletAddress ? `${participant.walletAddress.slice(0, 6)}...${participant.walletAddress.slice(-4)}` : `${participant.id.slice(0, 8)}...`}</span>
              <span className="text-zinc-400">{participant.joinStatus === "joined" ? "joined" : "pending"}</span>
            </div>
            {participant.joinTxHash && (
              <a
                className="text-primary underline"
                href={`${explorerUrl}/tx/${participant.joinTxHash}`}
                target="_blank"
                rel="noreferrer"
              >
                View join transaction
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
