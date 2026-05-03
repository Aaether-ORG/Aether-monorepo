# Human Checklist

> The things only humans can do. Allocate ~6-8 hours over 2-3 days for these.
> Tick each item as you finish it.

---

## Day 1 morning (2 hours): Get to "first install" green

### 1. Wallet setup (30 min)
- [ ] Generate **three fresh testnet keys** (don't reuse anything you've ever used on mainnet):
  - `WALLET_OWNER` — agent owner / contract deployer
  - `WALLET_TEE`   — TEE authority signer
  - `WALLET_BUYER` — buyer wallet (for demo)
- [ ] Fund WALLET_OWNER with **5+ 0G testnet tokens** via Discord faucet (`https://discord.com/invite/0glabs`)
- [ ] Fund WALLET_OWNER with **0.05+ Sepolia ETH** (https://sepoliafaucet.com)
- [ ] Fund WALLET_OWNER with **0.05+ Base Sepolia ETH** (https://www.alchemy.com/faucets/base-sepolia)
- [ ] Fund WALLET_BUYER with **1+ USDC on Base Sepolia** (https://faucet.circle.com)

### 2. Get API keys (30 min)
- [ ] **KeeperHub**: sign up at https://app.keeperhub.com → create a project → API token
- [ ] **Pinata** (or web3.storage): for IPFS pinning of agent cards
- [ ] (Optional) **Coinbase Developer Platform**: for a real x402 facilitator

### 3. Install + Day-0 (30 min)
```bash
cd aether
cp .env.example .env
# Fill in:
#   ZG_TESTNET_PRIVATE_KEY=$WALLET_OWNER
#   AGENT_OWNER_PRIVATE_KEY=$WALLET_OWNER
#   AETHER_TEE_AUTHORITY_KEY=$WALLET_TEE
#   SEPOLIA_PRIVATE_KEY=$WALLET_OWNER
#   KEEPERHUB_TOKEN=...
#   PINATA_JWT=...

pnpm install
pnpm day0
```

- [ ] All 10 Day-0 checks GREEN
- [ ] If `day0:compute` fails to find a provider for `glm-5-fp8`, set `ZG_COMPUTE_DEFAULT_MODEL` to one that's available (e.g. `gpt-oss-120b`)

### 4. Deploy contracts (30 min)
```bash
cd contracts
pnpm compile
pnpm test                 # all tests pass
pnpm deploy:zg            # AetherVerifier on 0G Galileo
```
- [ ] Capture printed `AetherVerifier` address → `.env` as `AETHER_VERIFIER_ADDRESS`

```bash
pnpm tsx scripts/deploy-agentnft.ts
```
- [ ] Read the output carefully. If 0G's deploy script deployed its own bundled verifier, manually call `updateVerifier()` on AgentNFT to point at our verifier
- [ ] Capture `AgentNFT` proxy address → `.env` as `AGENT_NFT_ADDRESS`

---

## Day 1 afternoon (2 hours): Get e2e flow green

### 5. First end-to-end run
```bash
cd ..
pnpm e2e   # one terminal — leaves running
```

In another terminal:
```bash
pnpm e2e:demo "What are the most cited cell-free protein synthesis papers?"
```
- [ ] arxiv search succeeds
- [ ] 0G Compute calls return content
- [ ] Storage uploads complete
- [ ] mint tx hash appears
- [ ] Buyer flow returns the report
- [ ] Replay endpoint returns chain-valid events

If anything fails, the error tells you what's misconfigured. **Common issues**:
- Provider address rotation → re-run `pnpm day0:compute` and update `.env`
- 0G Storage upload timeout → first run can take 30+ sec; retry once
- Mint reverts → AgentNFT may not be using your AetherVerifier; call `updateVerifier()`

### 6. Click through frontend
Open `http://localhost:5173`:
- [ ] Connect wallet → switch to 0G Galileo (frontend prompts you)
- [ ] Click a question → "Run agent →"
- [ ] Watch event cards animate in (real, not fixture — `fixture mode` pill should NOT be visible)
- [ ] Mint card appears with token #N + tx link
- [ ] Click "Buy report" → see 402 → sign EIP-3009 → unlock
- [ ] Click "Replay" → see "live · re-fetched from 0G Storage" pill + "✓ Chain valid"

---

## Day 2 morning (2 hours): ENS + ERC-8004

### 7. Buy an ENS name (15 min, ~$5)
- [ ] Visit https://app.ens.domains
- [ ] Search for `aether.eth` (or any name you like — `<your-team>.eth`)
- [ ] Register for 1 year
- [ ] Wait for tx to confirm

### 8. Deploy Durin L2 registry (15 min, ~$0.10)
- [ ] Visit https://durin.dev
- [ ] Connect wallet
- [ ] Select your parent name + Base Sepolia
- [ ] Click deploy
- [ ] Capture L2 Registry address → `.env` as `DURIN_L2_REGISTRY`

### 9. Deploy AmmoniteResolver (15 min)
```bash
cd contracts
pnpm deploy:resolver
```
- [ ] Capture address → `.env` as `AMMONITE_RESOLVER_ADDRESS`
- [ ] In ENS app or via Durin, set the L1 resolver of your parent name to this resolver

### 10. Mint subname + register in ERC-8004 (30 min)
```bash
cd ..
pnpm tsx layers/ammonite/scripts/setup-subname.ts thornbury
pnpm register:erc8004
```
- [ ] Subname `thornbury.aether.eth` resolves
- [ ] ERC-8004 agentId captured → `.env` as `ERC8004_AGENT_ID`
- [ ] Set the ENSIP-25 binding text record on your subname:
  - key: `agent-registration[0x8004A818BFB912233c491871b3d84c89A494BD9e][<your-agent-id>]`
  - value: `1`

### 11. Verify ENS resolution (15 min)
- [ ] In a browser or via viem, call `getEnsText({ name: 'thornbury.aether.eth', key: 'agent.services.x402' })` → returns the URL
- [ ] Call same for `agent.aether.head` → triggers CCIP-Read → returns live agent head

---

## Day 2 afternoon (2 hours): Production deploy

### 12. Deploy frontend to IPFS for `aether.eth.limo` (45 min)
Follow `docs/deploy.md`:
- [ ] Build frontend
- [ ] Upload `dist/` to IPFS (web3.storage or Pinata)
- [ ] In ENS app, set `aether.eth` Content Hash → `ipfs://<your-cid>`
- [ ] Wait 1-2 min for propagation
- [ ] Visit `https://aether.eth.limo` — frontend renders

### 13. Deploy Thornbury to Fly.io (45 min)
Follow `docs/deploy.md`:
- [ ] `fly launch --no-deploy`
- [ ] Add Dockerfile
- [ ] Set fly secrets (every env var in your local `.env`)
- [ ] `fly deploy`
- [ ] Verify `https://thornbury-aether.fly.dev/health` returns 200
- [ ] Update frontend env: `VITE_THORNBURY_URL=https://thornbury-aether.fly.dev`
- [ ] Re-deploy frontend with the new URL

### 14. Verify public demo
From a fresh browser session (incognito), visit `https://aether.eth.limo`:
- [ ] Connect wallet → run agent → mint → buy → replay
- [ ] All five steps work

---

## Day 3: Polish + record (2 hours)

### 15. FEEDBACK.md substance (30 min)
- [ ] Review every "TODO: write feedback" in `FEEDBACK.md`
- [ ] Replace with real items you encountered during deploy/testing
- [ ] Aim for 3+ pages: 5+ items per sponsor, each specific

### 16. Architecture diagram PNGs (15 min)
```bash
pnpm diagrams:export
```
- [ ] PNGs in `docs/diagrams/`
- [ ] Embed in submission READMEs (some ETHGlobal portals don't render mermaid)

### 17. Submission READMEs (30 min)
Walk through `submissions/CHECKLIST.md`:
- [ ] Replace every `<<...>>` placeholder
- [ ] Verify GitHub repo is PUBLIC
- [ ] Verify all links resolve

### 18. Demo video (45 min recording + 30 min editing)
Follow `docs/demo-script.md`:
- [ ] Pre-flight: every service running, wallets ready, browser zoom 110%
- [ ] Two laptops recording in parallel (insurance)
- [ ] Take 3-4 takes, pick the best
- [ ] Edit out dead air; aim for 2:55
- [ ] Upload to YouTube (unlisted) or Loom

### 19. Submit (30 min)
For each track in `submissions/`:
- [ ] Open the corresponding ETHGlobal submission form
- [ ] Paste from the per-track README
- [ ] Add demo video URL
- [ ] Add live demo URL
- [ ] Submit by midday — leave 12 hours of buffer for last-minute issues

---

## Bonus — if everything else is done

- [ ] **Twitter post**: tag `@0g_labs`, `@KeeperHubApp`, `@uniswapfnd`, `@ensdomains`. Use video thumbnail + 1-line pitch + GitHub link.
- [ ] **Farcaster cast** in `/agents`, `/ethereum`, `/0g` channels
- [ ] **Discord shoutout** in 0G's #showcase channel

## Pre-submission gotcha checklist

- [ ] Repo is PUBLIC, not private
- [ ] FEEDBACK.md is at repo root (not in a subdir)
- [ ] Demo video is under 3 minutes
- [ ] Live demo URL works from a fresh browser
- [ ] Contract addresses are filled in (not `0x...`)
- [ ] At least one minted iNFT exists on chainscan-galileo
- [ ] At least one storage upload visible on storagescan-galileo
- [ ] ENS subname resolves with real records (not just "exists")
