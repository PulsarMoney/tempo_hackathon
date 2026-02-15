"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ContactPickerProps = {
  onLookup: (type: "email" | "phone", value: string) => Promise<void>;
};

export function ContactPicker({ onLookup }: ContactPickerProps) {
  const [type, setType] = useState<"email" | "phone">("email");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!value.trim()) return;
    setLoading(true);
    try {
      await onLookup(type, value.trim());
      setValue("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-border bg-zinc-900/60 p-2">
      <div className="flex gap-2">
        <select
          className="h-9 rounded-md border border-border bg-zinc-950 px-2 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value as "email" | "phone")}
        >
          <option value="email">email</option>
          <option value="phone">phone</option>
        </select>
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === "email" ? "friend@email.com" : "+1..."} />
        <Button type="button" size="icon" onClick={submit} disabled={loading}>
          <Search className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
