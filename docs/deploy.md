# Production deploy guide

> Get the demo on a public URL so judges can hit it from anywhere.

## What needs to be hosted

| Component | Host | Why |
|---|---|---|
| Frontend | Vercel / Netlify / IPFS | Static bundle, fastest to ship |
| Thornbury server | Fly.io / Railway / Render | Long-running Node process |
| Ammonite gateway | Vercel / Cloudflare Workers | Serverless function |
| TEE worker | Fly.io / locally on demo laptop | Hold authority key |
| Smart contracts | 0G Galileo testnet | Already deployed via `pnpm deploy:zg` |

## Frontend → Vercel

```bash
cd frontend
pnpm build
npx vercel --prod
# Set in Vercel dashboard:
#   VITE_AGENT_NFT_ADDRESS=0x...
#   VITE_THORNBURY_URL=https://thornbury-aether.fly.dev
#   VITE_AETHER_VERIFIER_ADDRESS=0x...
```

Output: `https://aether-<your-id>.vercel.app`. Add a custom domain if you have one.

## Frontend → IPFS for `aether.eth.limo`

Ship the static bundle to IPFS and set ENS contenthash.

```bash
cd frontend
pnpm build

# Pin via web3.storage CLI
npx web3 put dist/ --token=$WEB3_STORAGE_TOKEN
# → returns CID, e.g. bafybeih...

# Or pin via Fleek / Filebase / Pinata UI

# Then in the ENS app at app.ens.domains:
#   - Select aether.eth → Records → Content Hash
#   - Paste: ipfs://bafybeih...
#   - Submit
```

Demo URL: `https://aether.eth.limo` (eth.limo gateway resolves contenthash automatically).

This is the **best ENS-track demo URL** — judges see "real ENS doing real work".

## Thornbury server → Fly.io

Fly is the simplest for a long-running Node process.

```bash
cd examples/thornbury
fly launch --no-deploy
```

Edit the generated `fly.toml`:

```toml
app = "thornbury-aether"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "3000"

[[services]]
  http_checks = []
  internal_port = 3000
  protocol = "tcp"

  [[services.ports]]
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443
```

Add a `Dockerfile`:

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY ../../pnpm-workspace.yaml ../../package.json ./
COPY ../../sdk ./sdk
COPY ../../layers ./layers
COPY ../../examples/thornbury ./examples/thornbury
RUN corepack enable && pnpm install --frozen-lockfile --filter @aether/thornbury...

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app /app
WORKDIR /app/examples/thornbury
EXPOSE 3000
CMD ["pnpm", "server"]
```

Set secrets:

```bash
fly secrets set ZG_TESTNET_PRIVATE_KEY=0x... \
  AGENT_OWNER_PRIVATE_KEY=0x... \
  AETHER_TEE_AUTHORITY_KEY=0x... \
  ZG_RPC_URL=https://evmrpc-testnet.0g.ai \
  ZG_INDEXER_RPC_URL=https://indexer-storage-testnet-turbo.0g.ai \
  ZG_COMPUTE_PROVIDER_ADDRESS=0x... \
  ZG_COMPUTE_DEFAULT_MODEL=glm-5-fp8 \
  AGENT_NFT_ADDRESS=0x... \
  AETHER_VERIFIER_ADDRESS=0x... \
  KEEPERHUB_TOKEN=... \
  KEEPERHUB_PROJECT_ID=... \
  CORS_ORIGIN=https://aether.eth.limo

fly deploy
```

Verify: `curl https://thornbury-aether.fly.dev/health`

## Ammonite gateway → Vercel function

Easier than serverless because we already have an Express handler.

Create `layers/ammonite/api/index.ts`:

```typescript
// Vercel serverless function adapter
import express from 'express';
// import the existing server logic here
export const config = { runtime: 'nodejs' };
export default function handler(req: any, res: any) {
  // route the request to our express app
  // (or just inline the logic from gateway/api/server.ts)
}
```

Or simpler: deploy the gateway as a tiny Fly app like Thornbury, with a smaller image.

## Putting it together

After deploys, update `.env` with:

```bash
VITE_THORNBURY_URL=https://thornbury-aether.fly.dev
THORNBURY_URL=https://thornbury-aether.fly.dev
AMMONITE_URL=https://aether-ccip.vercel.app
```

Final URLs to put in submission READMEs:
- Live demo: `https://aether.eth.limo` (or `aether-<id>.vercel.app`)
- Backend health: `https://thornbury-aether.fly.dev/health`
- Agent card: `https://thornbury-aether.fly.dev/.well-known/agent-card.json`

## Sanity check before submission

```bash
# From anywhere
curl https://aether.eth.limo                    # frontend renders
curl https://thornbury-aether.fly.dev/health    # backend up
curl "https://aether-ccip.vercel.app/lookup?key=agent.aether.head"  # gateway responds

# Click through:
# 1. https://aether.eth.limo
# 2. Connect wallet → switch to 0G Galileo
# 3. Run agent → events stream → mint completes
# 4. Click "Buy report" → 402 → sign EIP-3009 → unlock
# 5. Click "Replay" → events re-fetched from 0G Storage with chain validation
```

If all five work from a clean browser session, you're submission-ready.
