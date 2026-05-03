# Thornbury

The self-financing research agent example for the Aether SDK.

> Picks a question → fetches arxiv → summarizes via attested 0G Compute → synthesizes final report → mints as ERC-7857 iNFT → sells access via x402.

## Run locally

```bash
# 1. Make sure you've completed Day-0 verification at the repo root.
# 2. Start the paywall server in one terminal:
pnpm server

# 3. In another terminal, run a research pass:
pnpm research "What are the most cited cell-free protein synthesis papers?"

# 4. Try fetching the report (you'll get 402):
curl http://localhost:3000/report/<TOKEN_ID>
```

## Files

- `src/index.ts` — the research loop (Aether SDK consumer)
- `src/server.ts` — x402 paywall server
- `src/run-research.ts` — runs research + seeds server

## Submission targets

- **0G Best Autonomous Agents/iNFTs** ($1,500 likely) — we mint the report as iNFT
- **Uniswap Best API** (opportunistic) — buyer-side `pay-with-any-token` for the x402 challenge
- **KeeperHub** (Guard layer wraps the on-chain `authorizeUsage` calls)
