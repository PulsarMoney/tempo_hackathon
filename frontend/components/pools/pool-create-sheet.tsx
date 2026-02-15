"use client";

import { useState } from "react";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PoolCreateSheetProps = {
  onCreate: (payload: {
    title: string;
    entryAmount: string;
    tokenAddress: string;
    closeAt: string;
  }) => Promise<void>;
};

export function PoolCreateSheet({ onCreate }: PoolCreateSheetProps) {
  const [title, setTitle] = useState("Who closes higher by tonight?");
  const [entryAmount, setEntryAmount] = useState("5");
  const [tokenAddress, setTokenAddress] = useState(process.env.NEXT_PUBLIC_DEMO_TOKEN_ADDRESS ?? "");
  const [closeAt, setCloseAt] = useState(new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await onCreate({
        title,
        entryAmount,
        tokenAddress,
        closeAt: new Date(closeAt).toISOString(),
      });
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

        <Button onClick={submit} disabled={saving} className="w-full">
          {saving ? "Creating..." : "Create Pool"}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
