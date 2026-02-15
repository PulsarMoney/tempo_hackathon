"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, LogIn, LogOut, Wallet } from "lucide-react";
import { useActiveWallet, useLogin, useLogout, usePrivy, useWallets } from "@privy-io/react-auth";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TEMPO_TESTNET, TEMPO_TESTNET_CAIP2 } from "@/lib/tempo/chain";

function shortAddress(address?: string) {
  if (!address) {
    return "No wallet";
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function PrivyAuthControls() {
  const privyEnabled = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);
  if (!privyEnabled) {
    return <Badge variant="secondary">Privy disabled</Badge>;
  }

  return <PrivyAuthControlsEnabled />;
}

function PrivyAuthControlsEnabled() {
  const [providerReady, setProviderReady] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const lastSyncedSession = useRef<string | null>(null);

  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const { login } = useLogin();
  const { logout } = useLogout();
  const { wallets } = useWallets();
  const { wallet: activeWallet, setActiveWallet } = useActiveWallet();

  const activeEthereumWallet = activeWallet?.type === "ethereum" ? activeWallet : undefined;
  const chainId = activeEthereumWallet?.chainId;
  const onTempo = chainId === TEMPO_TESTNET_CAIP2;

  const canSetActiveWallet = !activeWallet && wallets.length > 0;

  const primaryWalletAddress = useMemo(() => {
    if (activeWallet?.address) {
      return activeWallet.address;
    }
    return wallets[0]?.address;
  }, [activeWallet?.address, wallets]);

  useEffect(() => {
    let cancelled = false;

    async function checkProvider() {
      if (!authenticated || !activeEthereumWallet) {
        setProviderReady(false);
        return;
      }

      try {
        const provider = await activeEthereumWallet.getEthereumProvider();
        await provider.request({ method: "eth_chainId" });
        if (!cancelled) {
          setProviderReady(true);
        }
      } catch {
        if (!cancelled) {
          setProviderReady(false);
        }
      }
    }

    void checkProvider();

    return () => {
      cancelled = true;
    };
  }, [authenticated, activeEthereumWallet]);

  useEffect(() => {
    let cancelled = false;

    async function syncUser() {
      if (!authenticated || !ready || !user) {
        return;
      }

      const token = await getAccessToken();
      if (!token) {
        return;
      }

      const currentSession = user.id;
      if (lastSyncedSession.current === currentSession) {
        return;
      }

      setSyncStatus("syncing");

      try {
        const response = await fetch("/api/auth/privy/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken: token,
            walletAddress: primaryWalletAddress,
            walletChainId: activeEthereumWallet?.chainId ?? null,
            linkedAccounts: user.linkedAccounts,
          }),
        });

        if (!response.ok) {
          throw new Error("sync failed");
        }

        if (!cancelled) {
          lastSyncedSession.current = currentSession;
          setSyncStatus("done");
        }
      } catch {
        if (!cancelled) {
          setSyncStatus("error");
        }
      }
    }

    void syncUser();

    return () => {
      cancelled = true;
    };
  }, [authenticated, ready, user, getAccessToken, primaryWalletAddress, activeEthereumWallet?.chainId]);

  if (!ready) {
    return <Badge variant="secondary">Auth loading...</Badge>;
  }

  if (!authenticated) {
    return (
      <Button onClick={() => login()} className="gap-2">
        <LogIn className="h-4 w-4" />
        Login
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="secondary" className="gap-1.5">
        <Wallet className="h-3.5 w-3.5" />
        {shortAddress(primaryWalletAddress)}
      </Badge>
      <Badge variant={onTempo ? "default" : "destructive"}>{onTempo ? "Tempo Testnet" : "Wrong network"}</Badge>
      <Badge variant="secondary">{providerReady ? "Signer ready" : "Signer not ready"}</Badge>
      <Badge variant="secondary">
        {syncStatus === "syncing" && "Syncing user..."}
        {syncStatus === "done" && (
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            Synced
          </span>
        )}
        {syncStatus === "error" && "Sync failed"}
        {syncStatus === "idle" && "Not synced"}
      </Badge>
      {canSetActiveWallet && (
        <Button variant="outline" size="sm" onClick={() => setActiveWallet(wallets[0])}>
          Set Active Wallet
        </Button>
      )}
      {!onTempo && activeEthereumWallet && (
        <Button variant="outline" size="sm" onClick={() => activeEthereumWallet.switchChain(TEMPO_TESTNET.id)}>
          Switch to Tempo
        </Button>
      )}
      <Button variant="outline" size="sm" className="gap-2" onClick={() => logout()}>
        <LogOut className="h-4 w-4" />
        Logout
      </Button>
    </div>
  );
}
