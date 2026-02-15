"use client";

import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";

import { TEMPO_TESTNET } from "@/lib/tempo/chain";

type AppPrivyProviderProps = {
  children: ReactNode;
};

export function AppPrivyProvider({ children }: AppPrivyProviderProps) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const clientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID;

  if (!appId) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      clientId={clientId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#336CFF",
          walletChainType: "ethereum-only",
        },
        loginMethods: ["wallet", "email", "google"],
        supportedChains: [TEMPO_TESTNET],
        defaultChain: TEMPO_TESTNET,
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
          showWalletUIs: true,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
