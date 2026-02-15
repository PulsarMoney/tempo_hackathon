"use client";

import { useState } from "react";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContactPicker } from "@/components/pools/contact-picker";

type PoolCreateSheetProps = {
  onCreate: (payload: {
    title: string;
    entryAmount: string;
    tokenAddress: string;
    closeAt: string;
    invitedParticipants: Array<{ type: "email" | "phone" | "privy"; value: string }>;
  }) => Promise<void>;
  onLookupContact: (type: "email" | "phone", value: string) => Promise<{ found: boolean; privyDid?: string; fallback: string }>;
};

export function PoolCreateSheet({ onCreate, onLookupContact }: PoolCreateSheetProps) {
  const [title, setTitle] = useState("Who closes higher by tonight?");
  const [entryAmount, setEntryAmount] = useState("5");
  const [tokenAddress, setTokenAddress] = useState(process.env.NEXT_PUBLIC_DEMO_TOKEN_ADDRESS ?? "");
  const [closeAt, setCloseAt] = useState(new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16));
  const [invites, setInvites] = useState<Array<{ type: "email" | "phone" | "privy"; value: string }>>([]);
  const [saving, setSaving] = useState(false);

  const handleLookup = async (type: "email" | "phone", value: string) => {
    const result = await onLookupContact(type, value);
    if (result.found && result.privyDid) {
      setInvites((prev) => [...prev, { type: "privy", value: result.privyDid as string }]);
    } else {
      setInvites((prev) => [...prev, { type, value: result.fallback }]);
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      await onCreate({
        title,
        entryAmount,
        tokenAddress,
        closeAt: new Date(closeAt).toISOString(),
        invitedParticipants: invites,
      });
      setInvites([]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet>
      <SheetContent className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-200">Create Pool</h3>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Pool title" />
        <div className="grid grid-cols-2 gap-2">
          <Input value={entryAmount} onChange={(e) => setEntryAmount(e.target.value)} placeholder="Entry amount" />
          <Input value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)} placeholder="Token address" />
        </div>
        <Input value={closeAt} onChange={(e) => setCloseAt(e.target.value)} type="datetime-local" />

        <ContactPicker onLookup={handleLookup} />

        {invites.length > 0 && (
          <div className="max-h-24 space-y-1 overflow-auto rounded-md border border-border bg-zinc-900/40 p-2 text-xs text-zinc-300">
            {invites.map((invite, idx) => (
              <div key={`${invite.value}-${idx}`}>{invite.type}: {invite.value}</div>
            ))}
          </div>
        )}

        <Button onClick={submit} disabled={saving} className="w-full">
          {saving ? "Creating..." : "Create Pool"}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
