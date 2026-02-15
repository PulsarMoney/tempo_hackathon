"use client";

import { Badge } from "@/components/ui/badge";

type TxStatus = "idle" | "signing" | "submitted" | "confirming" | "confirmed" | "failed";

export function TxStatusBadge({ status }: { status: TxStatus }) {
  if (status === "confirmed") {
    return <Badge className="border-success/60 bg-success/20 text-green-200">confirmed</Badge>;
  }
  if (status === "failed") {
    return <Badge variant="destructive">failed</Badge>;
  }
  if (status === "idle") {
    return <Badge variant="secondary">idle</Badge>;
  }
  return <Badge variant="secondary">{status}</Badge>;
}

export type { TxStatus };
