# Aether — Quick Start

> Minimal walkthrough from clone to live demo. Should take 60-90 minutes if everything cooperates.

## Prereqs

- Node 22+
- pnpm 9+
- A wallet with **0G Galileo testnet** tokens (5+ recommended). Faucet via [Discord](https://discord.com/invite/0glabs).
- A wallet with **Sepolia ETH** if you want to register in ERC-8004 (free Sepolia faucet).
- A wallet with **Base Sepolia ETH** if you want to mint Durin subnames (free faucet).
- A KeeperHub API key from [app.keeperhub.com](https://app.keeperhub.com) (optional but needed for Guard).

## 1. Install

```bash
cd aether
pnpm install
```

## 2. Configure env

```bash
cp .env.example .env
$EDITOR .env
```

Required for the minimum demo:
- `ZG_TESTNET_PRIVATE_KEY` — funded on 0G Galileo
- `AGENT_OWNER_PRIVATE_KEY` — same wallet (for dev) or a separate one
- `AETHER_TEE_AUTHORITY_KEY` — same key (for dev); production runs in TDX
- `ZG_COMPUTE_PROVIDER_ADDRESS` — leave empty initially; Day-0 fills it

Optional:
- `KEEPERHUB_TOKEN` for Guard
- `WEB3_STORAGE_TOKEN` for IPFS pinning of ERC-8004 agent cards

## 3. Day-0 verification — DO NOT SKIP

```bash
pnpm day0
```

This runs 10 checks. Each <30 sec. **Fix any failure before continuing.**

After `pnpm day0:compute` succeeds, copy the printed provider address into `.env`:
```
ZG_COMPUTE_PROVIDER_ADDRESS=0x...
```

## 4. Compile + deploy contracts

### Deploy AetherVerifier on 0G Galileo

```bash
cd contracts
pnpm install
pnpm compile
pnpm test                   # all unit tests should pass
pnpm deploy:zg              # deploys AetherVerifier
```

Capture the printed `AetherVerifier` address. Add to `.env`:
```
AETHER_VERIFIER_ADDRESS=0x...
```

### Deploy AgentNFT (the 0G reference contract) pointed at AetherVerifier

```bash
pnpm tsx scripts/deploy-agentnft.ts
```

This clones `0glabs/0g-agent-nft` (eip-7857-draft) into `.cache/`, configures it to use our verifier, and deploys. Capture `AGENT_NFT_ADDRESS` from output, save to `.env`.

### (optional) Deploy AmmoniteResolver on Base Sepolia for ENS

```bash
pnpm deploy:resolver
```

Capture `AmmoniteResolver` address — wire as ENS resolver via durin.dev or directly via the ENS app.

## 5. Run all services

```bash
cd ..   # back to repo root
pnpm e2e
```

This brings up:
- **Frontend** at http://localhost:5173
- **Thornbury server** at http://localhost:3000
- **TEE worker** at http://localhost:4000
- **Ammonite gateway** at http://localhost:8080

`Ctrl-C` once to stop all of them.

## 6. Drive the demo

In another terminal:

```bash
pnpm e2e:demo "What are the most cited cell-free protein synthesis papers?"
```

This will:
1. Health-check every service
2. POST to Thornbury → research session starts
3. Stream SSE events (you'll see them logged)
4. After completion, attempt the buy flow with mock signature
5. Verify replay endpoint works
6. Verify Ammonite gateway returns live data

OR drive interactively from the frontend at http://localhost:5173:
1. Connect your wallet (will prompt to switch to 0G Galileo)
2. Pick a question, click "Run agent →"
3. Watch events stream in
4. Click "Buy report" → goes through x402 → unlock
5. Click "Replay" → reconstructs event chain

## 7. Inspect on chain explorers

- Mint tx: `https://chainscan-galileo.0g.ai/tx/<MINT_TX>`
- Encrypted event blobs: `https://storagescan-galileo.0g.ai/tx/<UPLOAD_TX>`
- ERC-8004 registration (if done): `https://sepolia.etherscan.io/address/0x8004A818BFB912233c491871b3d84c89A494BD9e`

## 8. Build production bundle

```bash
pnpm frontend:build
# dist/ is now a static bundle, deploy to:
#   - Vercel/Netlify/Cloudflare (HTTP)
#   - IPFS via web3.storage (set ENS contenthash → resolves at *.eth.limo)
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `pnpm install` fails on `@0gfoundation/0g-ts-sdk` | Ensure Node 22+ |
| `day0:compute` says no provider for `glm-5-fp8` | List available models with `broker.inference.listService()`; pick one in `.env` |
| AgentNFT deploy errors on 0G Galileo | Make sure your wallet has 0G tokens. Check `pnpm day0:balance` |
| Frontend shows "fixture mode" pill | Backend (Thornbury server) is unreachable — ensure `pnpm e2e` is running |
| `report for token N not found` | Mint must complete before fetching report. Watch SSE for `mint` event first |
| KeeperHub auth fails | Verify `KEEPERHUB_TOKEN` from app.keeperhub.com; without it Guard is skipped (server still works) |
| ENS dynamic record returns empty | Gateway needs Thornbury session active — run a research first |

## Production hardening checklist

(Don't ship to mainnet without these.)

- [ ] Replace `AetherVerifier` with a real TEE/ZKP verifier (Phala Intel TDX recommended)
- [ ] Run TEE worker inside an actual enclave; key never leaves
- [ ] Replace mock x402 signature with full facilitator `/verify` + `/settle` calls
- [ ] Replace `payWithAnyToken` stub with real `@uniswap/ai-pay-with-any-token` once stable
- [ ] Pin every storage upload (turbo nodes drop after some retention)
- [ ] Use a separate wallet for the TEE authority (not the agent owner)
- [ ] Audit AmmoniteResolver before setting as a real ENS resolver

## Where things live

| Looking for | Path |
|---|---|
| The runtime | `sdk/src/aether.ts` |
| Smart contracts | `contracts/src/*.sol` |
| The example agent | `examples/thornbury/src/agent.ts` |
| The server | `examples/thornbury/src/server.ts` |
| The frontend | `frontend/src/` |
| Cross-track layers | `layers/{ammonite,guard,payments}/` |
| Architecture diagram | `docs/architecture-diagram.md` |
| Demo recording script | `docs/demo-script.md` |
| End-to-end flow doc | `docs/end-to-end-flow.md` |
| Per-track submissions | `submissions/{0g-framework,0g-agents,ens,keeperhub,uniswap}/README.md` |
| FEEDBACK.md | repo root |
