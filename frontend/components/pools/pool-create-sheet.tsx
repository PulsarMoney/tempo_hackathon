"use client";

import { useState } from "react";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function toLocalDateTimeValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

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
  const [closeAt, setCloseAt] = useState(toLocalDateTimeValue(new Date(Date.now() + 60 * 60 * 1000)));
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
        <h3 className="text-sm font-semibold text-zinc-200">Create a New Pool</h3>
        <p className="text-xs text-zinc-400">Set a question, entry amount, and close time. Users can join right away.</p>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Question (e.g. Who closes higher by tonight?)" />
        <div className="grid grid-cols-2 gap-2">
          <Input value={entryAmount} onChange={(e) => setEntryAmount(e.target.value)} placeholder="Entry amount" />
          <Input value={tokenAddress} readOnly disabled placeholder="Token address" />
        </div>
        <p className="text-[11px] text-zinc-500">Token is fixed to the configured demo stablecoin for this environment.</p>
        <Input value={closeAt} onChange={(e) => setCloseAt(e.target.value)} type="datetime-local" />

        <Button onClick={submit} disabled={saving} className="w-full">
          {saving ? "Creating Pool..." : "Create Pool"}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
