# @aether/frontend

Vite + React + Tailwind demo UI.

## Pages

- `/` — Home: pick a question, watch events stream in, see the iNFT mint
- `/agent/:tokenId` — Replay: reconstructs the agent's full history from event log
- `/buy` — Buyer flow: x402 paywall → Uniswap pay-with-any-token → unlock
- `/architecture` — Background reading

## Stack

- **Vite 5** — fast dev, static build
- **React 18 + Router 6**
- **Tailwind 3** — utility-first styling, dark theme
- **viem 2 + wagmi 2** — wallet + contract reads
- **TanStack Query** — wagmi peer dep

## Dev

```bash
pnpm dev      # http://localhost:5173
pnpm build    # static bundle in dist/
pnpm preview  # preview the production build
```

## Demo mode vs live mode

The home/replay pages currently use `useAgent` with a fixture sequence (in `lib/demoFixture.ts`).
This is intentional — the demo flows visibly even when the chain or 0G Compute is slow.

To switch to live data:
1. Wire `useAgent` to call your backend (the Thornbury server at `VITE_THORNBURY_URL`).
2. Stream `Aether` events over Server-Sent Events from the backend.
3. Listen for AgentNFT `Minted` event via `wagmi`'s `useWatchContractEvent`.

## Deploy

```bash
pnpm build
# Deploy dist/ to Vercel, Netlify, Cloudflare Pages, or IPFS via web3.storage / fleek.
# For ENS contenthash deploy:
#   ipfs add -r dist/  →  set contenthash on aether.eth → resolves at aether.eth.limo
```
