/** Network endpoints + contract addresses (verified 2026-04-28). */

export const ZG_GALILEO = {
  rpcUrl: 'https://evmrpc-testnet.0g.ai',
  chainId: 16601,
  explorer: 'https://chainscan-galileo.0g.ai',
  storageExplorer: 'https://storagescan-galileo.0g.ai',
  indexer: 'https://indexer-storage-testnet-turbo.0g.ai',
};

export const SEPOLIA = {
  chainId: 11155111,
  erc8004Identity:   '0x8004A818BFB912233c491871b3d84c89A494BD9e' as const,
  erc8004Reputation: '0x8004B663056A597Dffe9eCcC1965A193B7388713' as const,
};

export const BASE_SEPOLIA = {
  chainId: 84532,
  durinFactory: '0xDddddDdDDD8Aa1f237b4fa0669cb46892346d22d' as const,
  durinL1Resolver: '0x8A968aB9eb8C084FBC44c531058Fc9ef945c3D61' as const,
  usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const,
};

/** Filled at runtime from VITE_ env or after deploy. */
export const AETHER_ADDRS = {
  agentNFT: import.meta.env.VITE_AGENT_NFT_ADDRESS as `0x${string}` | undefined,
  verifier: import.meta.env.VITE_AETHER_VERIFIER_ADDRESS as `0x${string}` | undefined,
};
