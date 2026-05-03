# Submission fill-in checklist

> Walk down this list before each submission. Replace every `<<...>>` placeholder.

## Common (every track)

- [ ] **Project name** — set per track (see individual READMEs)
- [ ] **Short description** ≤ 200 chars — set per track
- [ ] **GitHub repo** — `https://github.com/<<your-team>>/aether` (must be PUBLIC)
- [ ] **Demo video** — `<<youtube-or-loom-url>>` (under 3 minutes)
- [ ] **Live demo** — `https://aether.eth.limo` or `https://aether-<<id>>.vercel.app`
- [ ] **Team contacts** — name + Telegram + X handle for each member

## 0G Framework ($7.5K)

- [ ] **Contract addresses** (replace placeholders in `submissions/0g-framework/README.md`):
  - `AETHER_VERIFIER_ADDRESS` — from `pnpm deploy:zg` output
  - `AGENT_NFT_ADDRESS` — from `deploy-agentnft.ts` output
  - `AGENT_NFT_BEACON` — from same output
- [ ] **Architecture diagram** — generate via `pnpm diagrams:export`, link the PNG
- [ ] **Working example agent** — `examples/thornbury/` is already there
- [ ] **Setup instructions** — `pnpm install && pnpm day0` (refer to `docs/quick-start.md`)

## 0G Agents ($1.5K likely)

- [ ] **Mint tx** — `https://chainscan-galileo.0g.ai/tx/<<MINT_TX>>`
- [ ] **iNFT explorer link** — same tx above
- [ ] **Encrypted blob** — `https://storagescan-galileo.0g.ai/tx/<<UPLOAD_TX>>`
- [ ] **Embedded intelligence proof** — explanation that `dataHashes[0]` is the chained Merkle root over events on 0G Storage; sealedKey is what unlocks them; replay endpoint demonstrates this works

## ENS Best for AI Agents ($1.25K)

- [ ] **Subname** — `<<thornbury>>.aether.eth` (or whichever parent name you registered)
- [ ] **AmmoniteResolver** — from `pnpm deploy:resolver` output (Base Sepolia)
- [ ] **L2 Registry** — from `durin.dev` output
- [ ] **ENSIP-25 binding** — set the text record `agent-registration[<<ERC8004_IDENTITY>>][<<AGENT_ID>>] = "1"`
- [ ] **ERC-8004 agent ID** — from `pnpm register:erc8004` output
- [ ] **CCIP-Read gateway URL** — `https://aether-ccip.vercel.app/{sender}/{data}`
- [ ] **Live resolution proof** — show the result of `viem.getEnsText({ name, key: 'agent.aether.head' })`

## ENS Creative ($1.25K) — *only submit if you have something for this*

- [ ] (skip unless you build the Mirror / Dust / Caller idea separately)

## KeeperHub ($2.5K main + $250 feedback)

- [ ] **Workflow examples** — point at `layers/guard/`
- [ ] **Audit trail screenshot** — capture from KeeperHub dashboard after a real authorizeUsage call
- [ ] **FEEDBACK.md** — 3+ pages of substance (real friction encountered, real feature requests)
- [ ] **Builder Feedback Bonus** — separate submission with the same FEEDBACK.md

## Uniswap ($1K-$2.5K)

- [ ] **FEEDBACK.md** at repo root (mandatory)
- [ ] **Real EIP-3009 signing path** — `layers/payments/src/buyer.ts` exercised in the `Buy` page
- [ ] **Cross-token note** — explicitly tells judge that pay-with-any-token integration uses the Claude skill (because it's a skill, not an SDK)
- [ ] **Demo segment** — a 30-sec clip in the demo video showing the buyer flow

## After every form is filled

- [ ] Test `pnpm e2e:demo` from a clean clone — does it still complete end-to-end?
- [ ] Click through demo from a fresh browser (no extension state) — does it work?
- [ ] Watch the video at full length — does it actually show what you say it shows?
- [ ] Re-read each per-track README — are all `<<...>>` filled in?
- [ ] Check FEEDBACK.md is at repo root (not in a subdirectory)
- [ ] Confirm GitHub repo is PUBLIC

## Final blocker check

- [ ] All four track-mandatory things present:
  - 0G Framework: working example agent + arch diagram
  - Gensyn AXL: NOT submitting (skip)
  - Uniswap: FEEDBACK.md
  - ENS: functional demo, no hardcoded values
  - KeeperHub: working demo + writeup
