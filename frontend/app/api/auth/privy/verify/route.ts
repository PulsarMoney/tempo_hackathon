import { NextResponse } from "next/server";
import { PrivyClient, verifyAccessToken } from "@privy-io/node";

import { upsertPrivyUser } from "@/lib/server/users";

export const runtime = "nodejs";

type VerifyBody = {
  accessToken?: string;
  walletAddress?: string;
  walletChainId?: string;
  linkedAccounts?: unknown;
};

const privyAppId = process.env.PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const privyAppSecret = process.env.PRIVY_APP_SECRET;
const privyVerificationKey = process.env.PRIVY_VERIFICATION_KEY;

const privyClient =
  privyAppId && privyAppSecret
    ? new PrivyClient({
        appId: privyAppId,
        appSecret: privyAppSecret,
        jwtVerificationKey: privyVerificationKey,
      })
    : null;

async function verifyToken(accessToken: string) {
  if (privyClient) {
    return privyClient.utils().auth().verifyAccessToken(accessToken);
  }

  if (privyAppId && privyVerificationKey) {
    return verifyAccessToken({
      access_token: accessToken,
      app_id: privyAppId,
      verification_key: privyVerificationKey,
    });
  }

  throw new Error("PRIVY_NOT_CONFIGURED");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as VerifyBody;

    if (!body.accessToken) {
      return NextResponse.json({ ok: false, error: "Missing accessToken" }, { status: 400 });
    }

    const verified = await verifyToken(body.accessToken);
    const dbResult = await upsertPrivyUser({
      privyUserId: verified.user_id,
      sessionId: verified.session_id,
      walletAddress: body.walletAddress,
      walletChainId: body.walletChainId,
      linkedAccounts: body.linkedAccounts,
    });

    return NextResponse.json({
      ok: true,
      userId: verified.user_id,
      sessionId: verified.session_id,
      persisted: dbResult.persisted,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "PRIVY_NOT_CONFIGURED" ? 500 : 401;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
