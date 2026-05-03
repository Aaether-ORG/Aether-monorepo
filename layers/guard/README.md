# @aether/guard

KeeperHub-backed reliability layer for Aether on-chain actions.

```ts
import { createGuard } from '@aether/guard';
import { ethers } from 'ethers';

const guard = createGuard();

// Wrap any tx
const result = await guard.submitTx({
  to: AETHER_INFT_ADDRESS,
  data: agentNFT.interface.encodeFunctionData('authorizeUsage', [tokenId, buyerAddr]),
}, {
  routing: 'private',
  maxRetries: 3,
  fallback: 'mpp',
});

console.log(result.txHash, result.attempts, result.fallbackUsed);
```

## Submission target

**KeeperHub Best Use of KeeperHub** ($4,500). Fills the gap that x402r leaves: x402r is reactive (refunds), Guard is proactive (retry + MPP fallback + KeeperHub audit).

## Day-0 verification

The MCP tool names above (`submit_transaction`, retry config) are based on research; they may differ in the live API. P3's first task: read `https://docs.keeperhub.com/ai-tools` end-to-end and confirm/adjust this client.
