# End-to-end orchestration

## `pnpm e2e`

Boots all four services in parallel with colored, prefixed logs:

| Service | URL |
|---|---|
| Frontend (Vite) | http://localhost:5173 |
| Thornbury server | http://localhost:3000 |
| TEE worker | http://localhost:4000 |
| Ammonite CCIP-Read gateway | http://localhost:8080 |

Press `Ctrl-C` once to stop all of them.

## `pnpm e2e:demo "your question"`

After services are running, run a complete end-to-end pass:

1. Health-check every service
2. POST `/research` to Thornbury
3. Subscribe to SSE events, log each one
4. After completion, GET `/report/:tokenId` (expect 402)
5. Re-fetch with `PAYMENT-SIGNATURE` (mock signature accepted by demo server)
6. GET `/agent/:tokenId/replay`
7. GET `agent.aether.head` from Ammonite gateway

If `AGENT_NFT_ADDRESS` is set, step 4-7 hit a real iNFT. Otherwise the run completes after step 3.

## Demo flow during recording

```bash
# Terminal 1
pnpm e2e

# Terminal 2 — drive from Frontend at http://localhost:5173
# (or use the demo-flow script for a CLI-only walk)
pnpm e2e:demo "What are the most cited cell-free protein synthesis papers?"
```
