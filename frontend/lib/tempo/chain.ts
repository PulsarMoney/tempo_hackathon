import { defineChain } from "viem";

export const TEMPO_TESTNET = defineChain({
  id: 42431,
  name: "Tempo Testnet",
  network: "tempo-testnet",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.moderato.tempo.xyz"],
    },
    public: {
      http: ["https://rpc.moderato.tempo.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "Tempo Explorer",
      url: "https://explore.tempo.xyz",
    },
  },
  testnet: true,
});

export const TEMPO_TESTNET_CAIP2 = `eip155:${TEMPO_TESTNET.id}`;
