# @aether/contracts

Smart contracts for Aether.

## What's here

- **`src/AetherVerifier.sol`** — our signature-based `IERC7857DataVerifier` implementation
- **`src/interfaces/IERC7857DataVerifier.sol`** — the spec interface (verbatim from `0glabs/0g-agent-nft`)
- **`scripts/deploy.ts`** — deploys `AetherVerifier`
- **`scripts/deploy-agentnft.ts`** — clones `0glabs/0g-agent-nft` and deploys `AgentNFT` pointing to our verifier

## Quick start

```bash
pnpm install
pnpm compile
pnpm test

# Deploy AetherVerifier on 0G Galileo
pnpm deploy:zg

# Then set AETHER_VERIFIER_ADDRESS in ../.env
# Then deploy the official AgentNFT against our verifier
pnpm tsx scripts/deploy-agentnft.ts
```

## Notes

The `AgentNFT` contract from 0G's reference repo uses a UUPS upgradeable proxy. We do **not** modify it — we only deploy it with our `AetherVerifier` address as the `verifierAddr` parameter to `initialize()`.

`AetherVerifier` accepts ECDSA signatures from a designated `authority` address (the off-chain TEE worker's key). Production replaces this contract with a real TEE/ZKP verifier (e.g., Phala's Intel TDX worker).
