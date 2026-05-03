# @aether/ammonite

ENS dynamic agent cards via Durin + ENSIP-25 + CCIP-Read.

## What this gives you

Resolving `thornbury.aether.eth` returns a *live* agent card — model version, uptime, latest event hash — pulled from 0G Storage at resolve-time. Static text records (ENSIP-25 binding, ERC-8004 reference, etc.) are stored on the L2 registry; dynamic records flow through the CCIP-Read gateway.

## Pieces

- `src/records.ts` — text record schema + ENSIP-25 key construction
- `gateway/api/server.ts` — CCIP-Read gateway (Node http server, deploy as Cloudflare/Vercel function)
- `scripts/setup-subname.ts` — mints a subname + sets static records on Durin

## Submission target

**ENS Best ENS for AI Agents** ($2,500). The novelty isn't ENSIP-25 itself (already a standard); it's the *dynamic* CCIP-Read layer returning live agent state, which nobody has shipped on top of ENSIP-25.

## Day-0 deps

1. Own `aether.eth` (or any parent name) on mainnet ENS
2. Deploy L2 registry via [durin.dev](https://durin.dev) on Base Sepolia
3. Set `DURIN_L2_REGISTRY` in `.env`

## Run gateway

```bash
pnpm dev:gateway
# Test: curl "http://localhost:8080/0x.../0x...?name=thornbury&key=agent.aether.head"
```
