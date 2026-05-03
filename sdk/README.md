# @aether/sdk

The Aether runtime SDK.

```ts
import { Aether } from '@aether/sdk';
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(process.env.ZG_RPC_URL);
const wallet = new ethers.Wallet(process.env.ZG_TESTNET_PRIVATE_KEY!, provider);

const aether = await Aether.create({
  rpcUrl: process.env.ZG_RPC_URL!,
  indexerUrl: process.env.ZG_INDEXER_RPC_URL!,
  ownerWallet: wallet,
  computeProviderAddress: process.env.ZG_COMPUTE_PROVIDER_ADDRESS!,
  defaultModel: 'glm-5-fp8',
  agentNFTAddress: process.env.AGENT_NFT_ADDRESS,
});

// 1. Run an attested inference
const { content, eventHash } = await aether.chat([
  { role: 'user', content: 'What are the most cited papers on cell-free protein synthesis from Q1 2026?' },
]);
console.log(content, eventHash);

// 2. Wrap any tool call as an event
const papers = await aether.tool('arxiv_search', { q: 'cell-free protein synthesis' }, async () => {
  // ... fetch arxiv ...
  return ['paper1', 'paper2'];
});

// 3. Mint the agent's life as an iNFT
const { tokenId, txHash } = await aether.mint();

// 4. Replay locally
for await (const event of aether.replay()) {
  console.log(event.type, event.ts);
}
```

## Modules

- `aether.ts` — main runtime
- `events.ts` — event schema, hashing
- `compute/` — 0G Compute broker wrapper, captures TEE attestation
- `storage/` — 0G Storage event log, AES-128-GCM encryption, ECIES-style key sealing
- `replay/` — deterministic replay engine
- `erc8004/` — ERC-8004 client (registration, feedback)

## Tests

```bash
pnpm test
```
