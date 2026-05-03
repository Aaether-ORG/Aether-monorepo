# @aether/scripts

Day-0 verification + utility scripts.

## Day-0 verification

Run **before** writing any feature code.

```bash
pnpm install   # from repo root
cd scripts
pnpm tsx day0/run-all.ts
```

Or one at a time:

| Script | Checks |
|---|---|
| `01-rpc.ts` | 0G Galileo RPC reachable + correct chain ID |
| `02-balance.ts` | Wallet has 0G testnet tokens |
| `03-compute.ts` | 0G Compute broker discovers services + finds default model |
| `04-storage.ts` | 0G Storage upload + decrypt roundtrip |
| `05-deploy-verifier.ts` | AetherVerifier compiles + tests pass |
| `06-erc8004.ts` | ERC-8004 contracts live on Sepolia |
| `07-durin.ts` | Durin L2 factory live on Base Sepolia |
| `08-x402.ts` | x402 facilitator reachable |
| `09-keeperhub.ts` | KeeperHub MCP reachable + bearer auth works |
| `10-ens.ts` | ENS mainnet resolution sanity check |

If anything fails, **fix that before building anything else.** Don't build features on top of unverified infrastructure.

## Optional flags

- `TEST_INFERENCE=1` — set in `.env` to make `03-compute.ts` actually call inference (costs 0G tokens)
- `MAINNET_RPC=...` — override mainnet ENS RPC
- `BASE_SEPOLIA_RPC=...` — override Base Sepolia RPC
