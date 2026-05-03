import { http, createConfig } from 'wagmi';
import { defineChain } from 'viem';
import { sepolia, baseSepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

/** 0G Galileo Testnet (Chain ID 16601). */
export const ogGalileo = defineChain({
  id: 16602,
  name: '0G Galileo Testnet',
  nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://evmrpc-testnet.0g.ai'] },
  },
  blockExplorers: {
    default: { name: 'ChainScan Galileo', url: 'https://chainscan-galileo.0g.ai' },
  },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [ogGalileo, sepolia, baseSepolia],
  connectors: [injected()],
  transports: {
    [ogGalileo.id]: http(),
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
