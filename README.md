# Aether

> **Replayable, mintable agent runtime on 0G.**
> Every agent action becomes a content-addressed event in 0G Storage; every inference is TEE-attested via 0G Compute; the agent's running state freezes as a transferable ERC-7857 iNFT — and access is monetised on-chain via x402 + a native ZGUSD stablecoin we deployed on 0G Galileo.

ETHGlobal **OpenAgents 2026** submission — targeting four sponsor tracks with one cohesive project.

---

## Table of contents

1. [The thesis](#the-thesis)
2. [What we built](#what-we-built)
3. [Architecture overview](#architecture-overview)
4. [Live deployments](#live-deployments)
5. [Repo layout](#repo-layout)
6. [Local setup — prerequisites](#local-setup--prerequisites)
7. [Local setup — step-by-step](#local-setup--step-by-step)
8. [Running the demo end-to-end](#running-the-demo-end-to-end)
9. [Per-track deep dives](#per-track-deep-dives)
10. [Contract reference](#contract-reference)
11. [Event schema](#event-schema)
12. [Buyer flow — x402 + ZGUSD walkthrough](#buyer-flow--x402--zgusd-walkthrough)
13. [Replay flow](#replay-flow)
14. [ENS dynamic resolution](#ens-dynamic-resolution)

---

## The thesis

Existing standards already define how an agent is **named** (ENS / ERC-8004) and **owned** (ERC-7857). What none of them define is what an agent **is**: nobody has shipped the agent's *own life history* — its inferences, fetches, decisions — in a verifiable, replayable form.

Today, when you mint an agent on 0G, what you mint is a snapshot. A `character.json`. Maybe some weights. The buyer gets a clone, not a being. There is no record of what the agent has done, no proof of what model it ran, no way to replay its decisions. That is the gap Aether fills.

**Aether is the missing primitive: the agent's life as a content-addressed, encrypted, replayable log on 0G Storage, frozen into the iNFT, sold via x402, resolved live via ENS.**

> *"We are the bookkeeping layer every agent on 0G is going to need."*

---

## What we built

| Layer | What it is | Where to find it |
|---|---|---|
| **Aether SDK** | TypeScript runtime that records `inference` / `tool_call` / `observation` / `state_mutation` / `mint` events into a Merkle-linked log on 0G Storage and surfaces a clean replay API | `sdk/` |
| **AetherVerifier.sol** | Custom signature-based `IERC7857DataVerifier` for the ERC-7857 reference contract | `contracts/src/AetherVerifier.sol` |
| **AgentNFT.sol** | 0G's official ERC-7857 reference (non-upgradeable variant) — deployed unchanged, pointed at our verifier | `contracts/src/AgentNFT.sol` |
| **ZGUSD.sol** | Native ERC-20 + EIP-3009 stablecoin we deployed on 0G Galileo so the entire x402 buyer flow stays on 0G | `contracts/src/ZGUSD.sol` |
| **Thornbury** | Self-financing research agent — picks a question, fetches arxiv papers, summarises through `qwen-2.5-7b` on 0G Compute, mints the report as an iNFT, paywalls `/report/:tokenId` | `examples/thornbury/` |
| **Ammonite (ENS)** | Live agent cards via ENSIP-25 + Durin + CCIP-Read at `aaether.eth` (Sepolia) → resolves dynamic state from 0G Storage at resolve-time | `layers/ammonite/` |
| **Guard (KeeperHub)** | KeeperHub-backed reliability wrapper for x402 settlements with documented bug-fallback for the live 0G Galileo timeout | `layers/guard/`, `FEEDBACK.md` |
| **Payments (Uniswap)** | Server-side x402 envelope + EIP-3009 buyer helper that reads everything from the challenge — zero client-side hardcoding | `layers/payments/` |
| **Frontend** | Vite + React mission-control terminal; four pages (Run / Replay / Buy / Spec); reads asset, network, and EIP-712 domain from the server's challenge | `frontend/` |
| **TEE worker** | Node.js authority that signs preimage/transfer claims (production swaps for TDX) | `services/tee-worker/` |

Every layer is wired to **real** infrastructure — real arxiv API, real 0G Compute provider, real `Indexer.upload(MemData)` to 0G Storage, real on-chain mint, real EIP-712 signing, real `transferWithAuthorization()` settlement. The only intentional stub is `AetherVerifier`, which uses ECDSA from a designated authority instead of a real TEE/ZKP attestation — and it implements 0G's `IERC7857DataVerifier` interface verbatim, so production swaps the authority for an Intel TDX worker without changing a line of contract code.

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                  Aether SDK (off-chain runtime)                      │
│                                                                      │
│   Agent code  ─►  Event logger  ─►  0G Storage (encrypted)           │
│        │              (canonical JSON, AES-128 master key)           │
│        ├── chat()  ─► 0G Compute broker ─► TeeML attestation         │
│        ├── tool()  ─► ToolCallEvent                                  │
│        ├── observe()  ─► ObservationEvent                            │
│        └── setState() ─► StateMutationEvent                          │
│                                                                      │
│   On finish:  Merkle root over event roots → AgentNFT.mint(...)      │
└────────────────────────────────────────────────────────────────────┬─┘
                                                                     │
                                                                     ▼
                            ┌─────────────────────────────────────────┐
                            │          0G Galileo Testnet              │
                            │          (chain id 16602)                │
                            │                                          │
                            │  AetherVerifier  (sig-based, our impl)   │
                            │  AgentNFT        (0glabs reference)      │
                            │  ZGUSD           (ERC-20 + EIP-3009)     │
                            └─────────────────────────────────────────┘

   Cross-track layers
   ──────────────────
   • Ammonite (ENS)  — aaether.eth → live agent state via CCIP-Read
   • Guard (KeeperHub) — workflow wrapping authorizeUsage + retry/fallback
   • Payments (Uniswap) — x402 envelope + EIP-3009 buyer helper
```

A more detailed walkthrough lives in `docs/architecture.md` and `docs/end-to-end-flow.md`.

---

## Live deployments

All on **0G Galileo testnet — chain id 16602** unless otherwise noted.

| Artifact | Address / id | Explorer |
|---|---|---|
| AgentNFT (ERC-7857) | `0x7b09a692d9d6c55b9Ed8ddf61e9cde847cC3910f` | [view](https://chainscan-galileo.0g.ai/address/0x7b09a692d9d6c55b9Ed8ddf61e9cde847cC3910f) |
| AetherVerifier | `0x9f4FF2Bf926D63045023B5E3790AE13A39184070` | [view](https://chainscan-galileo.0g.ai/address/0x9f4FF2Bf926D63045023B5E3790AE13A39184070) |
| ZGUSD (EIP-3009) | `0xcCd66655fF08b5A25a6bf4bc3b51d380c976AbfF` | [view](https://chainscan-galileo.0g.ai/address/0xcCd66655fF08b5A25a6bf4bc3b51d380c976AbfF) |
| Thornbury iNFT | token #1 | [tx](https://chainscan-galileo.0g.ai) |
| **Ammonite (ENS)** — root name | `aaether.eth` (Sepolia) | [view](https://sepolia.app.ens.domains/aaether.eth) |
| **Ammonite (ENS)** — L1 resolver (Durin stock) | `0x8A968aB9eb8C084FBC44c531058Fc9ef945c3D61` (Sepolia) | [view](https://sepolia.etherscan.io/address/0x8A968aB9eb8C084FBC44c531058Fc9ef945c3D61) |
| **Ammonite (ENS)** — L2 registry (Durin) | `0x46f0058d5187b39c5cbdfa325637479bbfbf8a65` (Base Sepolia) | [view](https://sepolia.basescan.org/address/0x46f0058d5187b39c5cbdfa325637479bbfbf8a65) |
| **Ammonite (ENS)** — DurinL2Registrar | `0x41CE8E3dF8b5828B2d90057D71164d089FF2312f` (Base Sepolia) | [view](https://sepolia.basescan.org/address/0x41CE8E3dF8b5828B2d90057D71164d089FF2312f) |
| **Ammonite (ENS)** — CCIP-Read gateway | `pnpm ammonite:gateway` → `localhost:8080` (deploy to Cloudflare/Vercel) | – |
| **Ammonite (ENS)** — custom AmmoniteResolver.sol | written but **not** deployed for demo (Durin's stock resolver was used instead — see note below) | – |
| ERC-8004 IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` (Sepolia) | [view](https://sepolia.etherscan.io/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) |
| ERC-8004 agent id | `4098` | – |
| Agent card (IPFS) | `ipfs://Qme9nLUt2z3MAB7VVcPMLfQh3XgZBRge9Mgfqs87NhG32z` | – |

> **Note on AmmoniteResolver.sol** — `contracts/src/AmmoniteResolver.sol` is our custom L1 resolver (wildcard ENSIP-10 + CCIP-Read for dynamic keys). For the live demo we instead pointed `aaether.eth` at **Durin's stock L1 resolver** (`0x8A96…3D61`), since it already implements the L1↔L2 hop we need and works out of the box on Sepolia. The "Ammonite" submission is the **gateway + record schema + dynamic-key set**, not a custom resolver contract; the Solidity file is shipped for production use cases where the Durin resolver isn't a fit.

> All testnet deployments. **Do not** reuse any of the keys committed to history — they are burnable testnet keys and should be rotated before any production use.

---

## Repo layout

```
aether/
├── contracts/                # Hardhat workspace
│   ├── src/
│   │   ├── AetherVerifier.sol     # IERC7857DataVerifier, sig-based
│   │   ├── AgentNFT.sol           # 0G reference, non-upgradeable variant
│   │   ├── ZGUSD.sol              # ERC-20 + EIP-3009 stablecoin on 0G
│   │   ├── AmmoniteResolver.sol   # ENS L1 resolver with CCIP-Read
│   │   ├── DurinL2Registrar.sol   # Durin subname mint helper
│   │   └── interfaces/
│   └── scripts/                   # deploy.ts, deploy-agentnft.ts, ...
│
├── sdk/                       # @aether/sdk (TypeScript runtime)
│   └── src/
│       ├── aether.ts          # Public Aether class
│       ├── events.ts          # Event types + canonical hashing
│       ├── compute/           # 0G Compute broker wrapper (TEE-aware)
│       ├── storage/           # 0G Storage adapter (encryption + log)
│       ├── replay/            # Deterministic replay engine
│       └── erc8004/           # ERC-8004 IdentityRegistry client
│
├── frontend/                  # Vite + React + Tailwind demo UI
│   └── src/
│       ├── pages/             # Home (Run) · Agent (Replay) · Buy · Architecture
│       ├── components/        # EventStream, EventCard, TxLink, WalletButton, …
│       ├── hooks/useAgent.ts  # Drives the SSE stream (with fixture fallback)
│       └── lib/               # wagmi config, addresses, format helpers
│
├── services/
│   └── tee-worker/            # Node.js TEE authority (dev) — TDX in prod
│
├── layers/
│   ├── ammonite/              # ENS dynamic agent cards (CCIP-Read gateway)
│   ├── guard/                 # KeeperHub workflow wrapper + fallback
│   └── payments/              # x402 envelope helpers, EIP-3009 buyer
│
├── examples/
│   └── thornbury/             # Self-financing research agent
│       ├── src/agent.ts       # The agent loop
│       └── src/server.ts      # Express + x402 paywall + SSE
│
├── scripts/
│   ├── day0/                  # 10 health checks before recording demo
│   ├── e2e/                   # start-all.ts, demo-flow.ts
│   ├── setup/                 # check-zgusd.ts, mint-zgusd.ts, …
│   └── registration/          # ERC-8004 + Durin set-registry helpers
│
├── submissions/               # Per-track submission READMEs
│   ├── 0g-framework/          # Best Agent Framework
│   ├── 0g-agents/             # Best iNFT (Thornbury)
│   ├── ens/                   # Best ENS for AI Agents
│   └── keeperhub/             # Best Use of KeeperHub
│
├── docs/                      # architecture, end-to-end, deploy, demo-script
├── FEEDBACK.md                # KeeperHub Builder Bounty submission
├── PITCH_FOR_0G.md            # Live pitch script for 0G team
└── package.json               # pnpm workspace root
```

---

## Local setup — prerequisites

| Tool | Version | Why |
|---|---|---|
| Node.js | **>= 22** | 0G SDKs require modern Node; tsx ESM loader |
| pnpm | **>= 9** | Workspace package manager |
| git | any modern | clone |
| MetaMask (or any injected wallet) | latest | sign EIP-712, mint, buy |

Funded testnet wallets (free faucets):

| Network | Why | Faucet |
|---|---|---|
| 0G Galileo (chain 16602) | Deploy + run agent + mint iNFT | Discord faucet at `discord.com/invite/0glabs` |
| Sepolia | ERC-8004 register + ENS Durin parent | publicnode.com / Alchemy |
| Base Sepolia | Durin L2 registry deploy | basescan.org faucet |

Optional accounts:

- KeeperHub API token (`app.keeperhub.com`) — for the Guard layer; flow degrades gracefully without it
- Pinata JWT — for IPFS pinning of the ERC-8004 agent card

---

## Local setup — step-by-step

### 1. Clone and install

```bash
git clone https://github.com/<your-team>/aether
cd aether
pnpm install
```

This bootstraps every workspace package: `contracts/`, `sdk/`, `frontend/`, `services/tee-worker/`, `layers/{ammonite,guard,payments}/`, `examples/thornbury/`, `scripts/`.

### 2. Configure environment

```bash
cp .env.example .env
$EDITOR .env
```

Fill at minimum:

```
ZG_TESTNET_PRIVATE_KEY=0x…       # funded on 0G Galileo
AGENT_OWNER_PRIVATE_KEY=0x…      # same wallet OK for dev
AETHER_TEE_AUTHORITY_KEY=0x…     # same key OK for dev (TDX in prod)
SEPOLIA_PRIVATE_KEY=0x…          # for ERC-8004 + ENS
```

Aether-specific env that gets populated as you deploy:

```
AETHER_VERIFIER_ADDRESS=
AGENT_NFT_ADDRESS=
ZGUSD_ADDRESS=
ZGUSD_NAME=ZG-USD
ZGUSD_VERSION=2
ZGUSD_DECIMALS=6
X402_NETWORK=16602
AGENT_PAYMENT_ADDRESS=0x…        # the seller / Thornbury wallet
AETHER_TOKEN_ID=1
ERC8004_AGENT_ID=4098
ENS_PARENT=aaether.eth
```


### 3. Day-0 verification — DO NOT SKIP

```bash
pnpm day0
```

Runs 10 sub-checks (RPC reachable, balance > 0, 0G Compute provider responsive, 0G Storage upload working, ERC-8004 contracts callable, x402 envelope round-trips, KeeperHub auth, ENS resolution, …). Each check finishes in < 30 s. Fix any RED before continuing.

After `pnpm day0:compute` succeeds it prints a provider address — paste it into `.env`:

```
ZG_COMPUTE_PROVIDER_ADDRESS=0x…
```

### 4. Deploy contracts

#### AetherVerifier (0G Galileo)

```bash
cd contracts
pnpm compile
pnpm test
pnpm deploy:zg
```

Capture the printed `AetherVerifier` address → `.env` → `AETHER_VERIFIER_ADDRESS=`.

#### AgentNFT (0G's ERC-7857 reference, pointed at our verifier)

```bash
pnpm tsx scripts/deploy-agentnft.ts
```

This deploys 0G's reference contract from the `eip-7857-draft` branch verbatim, configured to use the verifier you just deployed. Capture `AGENT_NFT_ADDRESS` → `.env`.

#### ZGUSD (the native stablecoin for x402)

```bash
pnpm tsx scripts/deploy-zgusd.ts
```

Deploys our `ERC-20 + EIP-3009 + EIP-712` stablecoin on 0G Galileo. Domain name is `"ZG-USD"`, version `"2"`, decimals `6` — these MUST match `.env` exactly because the buyer signs EIP-712 against them.

Mint a test float to your buyer wallet:

```bash
pnpm tsx scripts/setup/mint-zgusd.ts --to 0xYourWallet --amount 100
```

#### (optional) AmmoniteResolver on Base Sepolia for ENS

```bash
pnpm deploy:resolver
```

Then wire as the ENS resolver via `durin.dev` (or directly in the ENS app). The ENS parent name is `aaether.eth` on Sepolia.

### 5. Register the agent on ERC-8004

```bash
pnpm register:erc8004
```

Hits Sepolia `IdentityRegistry` (`0x8004A818BFB912233c491871b3d84c89A494BD9e`), pins the agent card to IPFS via Pinata, and sets the Durin record. Captures `agentId` (we got 4098).

### 6. Run all four services

```bash
cd ..
pnpm e2e
```

Boots, with prefixed coloured logs:

| Service | URL |
|---|---|
| Frontend (Vite) | http://localhost:5173 |
| Thornbury server | http://localhost:3000 |
| TEE worker | http://localhost:4000 |
| Ammonite CCIP-Read gateway | http://localhost:8080 |

`Ctrl-C` stops them all.

### 7. (alternative) Run each service manually

```bash
pnpm frontend:dev          # http://localhost:5173
pnpm thornbury:server      # http://localhost:3000
pnpm tee:start             # http://localhost:4000
pnpm ammonite:gateway      # http://localhost:8080
```

---

## Running the demo end-to-end

### From the frontend

1. Open http://localhost:5173.
2. Connect a wallet — the **AUTH NODE** key prompts MetaMask. Approve the chain switch to 0G Galileo (16602).
3. Pick a preset question (or type your own) on the Run page. Click **EXECUTE**.
4. Watch the event tape stream in: `OBSRV` (arxiv hits) → `INFER` (qwen-2.5-7b summaries, each TEE-attested) → `INFER` (final synthesis) → `MUTAT` (state set) → `MINT`.
5. The mint receipt appears with the iNFT token id and a chainscan-galileo tx link.
6. Click **REPLAY ▶** to open `/agent/:tokenId` — black-box recorder readout reconstructs the event chain frame-by-frame, then verifies all `prevHash` links in O(n).
7. Click **BUY REPORT · x402** to open `/buy`. Enter the token id (defaults to 1). The live ZGUSD ticker shows your wallet's balance and the seller's balance. Hit **EXECUTE ORDER**:
   - Server returns `402` with `PAYMENT-REQUIRED` header.
   - Frontend parses `accepts[0]`, reads the asset / payTo / amount / EIP-712 domain (name + version + decimals) — **nothing is hardcoded**.
   - Wallet signs `TransferWithAuthorization` typed-data.
   - Server submits real `ZGUSD.transferWithAuthorization()` on chain → `settleTxHash`.
   - Server calls `agentNFT.authorizeUsage(tokenId, buyer)` (via Guard with KeeperHub fallback) → `authzTxHash`.
   - Server calls KeeperHub for an audit attestation → `auditId`.
   - Three tx hashes appear in the proof block; report unlocks.

### Headless e2e (CI-shaped)

```bash
pnpm e2e:demo "What are the most cited cell-free protein synthesis papers from Q1 2026?"
```

This script: health-checks every service → POSTs `/research` → consumes SSE → triggers buy with mock signature → triggers replay → calls Ammonite gateway. Exits non-zero on any failure.

---

## Per-track deep dives

### 0G Best Agent Framework — Aether runtime

We deploy `0glabs/0g-agent-nft` (eip-7857-draft branch) verbatim and add a single contract: `AetherVerifier`. The SDK is what the framework prize is really about — `aether.chat()`, `aether.tool()`, `aether.observe()`, `aether.setState()`, `aether.mint()`. Each call generates a typed event, encrypts it with the agent's AES-128 master key (16 bytes — matching ERC-7857's `bytes16 sealedKey` constraint), uploads it via `Indexer.upload(MemData, …)`, and updates the event-hash chain.

Why "framework-level": this is the bookkeeping layer every other agent on 0G will need — for compliance, for resale, for insurance, for replay.

Submission README → `submissions/0g-framework/README.md`

### 0G Best Autonomous Agents/iNFTs — Thornbury

Self-financing research agent. Picks an arxiv-shaped question, fetches papers via the real arxiv API, summarises each via 0G Compute's `qwen-2.5-7b` model with TeeML attestation captured into the event log, synthesises a final report, mints the report as an iNFT, and paywalls `/report/:tokenId` for $0.50 worth of ZGUSD.

The closed economic loop:

```
buyer pays ZGUSD ─► server settles via transferWithAuthorization ─► seller balance up
seller refunds 0G Compute ledger ─► next research session ─► next mint ─► next sale
```

Every inference is replayable: buyers can verify which papers Thornbury read and which model produced the synthesis.

Submission README → `submissions/0g-agents/README.md`

### ENS Best Integration — Ammonite

Resolving `aaether.eth` returns a *live* agent card via standard ENS resolution. Static records live on a Durin L2 registry (Base Sepolia); dynamic records (`agent.aether.head`, `agent.uptime.last24h`, `agent.model.version`) revert with `OffchainLookup` (EIP-3668) → our gateway queries the agent's running event log on 0G Storage → returns the live value.

ENSIP-25 binding text record (`agent-registration[<registry>][<agentId>]`) verifies the agent on Sepolia ERC-8004 IdentityRegistry. Service-discovery records resolve to `x402://thornbury…` and `mcp://thornbury…` endpoints.

Submission README → `submissions/ens/README.md`

### KeeperHub Best Use — Guard

Drop-in middleware that turns any on-chain settlement into a KeeperHub workflow with retry, gas optimisation, private routing, and audit trail. We attempted to use it for `authorizeUsage` on 0G Galileo and hit a reproducible **Cloudflare 524 timeout** in KeeperHub's broadcaster — Base Sepolia returns in 539 ms, 0G Galileo hangs > 120 s. Documented exactly that bug in `FEEDBACK.md` and shipped a **direct-fallback** path that signs locally with the KeeperHub wallet's exported private key after a 90 s timeout.

The fallback still produces a real on-chain authorize tx — the flow does not break. The audit attestation is recorded either way.

Submission README → `submissions/keeperhub/README.md`
Builder Feedback Bounty → `FEEDBACK.md`

---

## Contract reference

### AetherVerifier (`contracts/src/AetherVerifier.sol`)

Implements 0G's `IERC7857DataVerifier`:

```solidity
function verifyPreimage(bytes[] calldata proofs) external view returns (PreimageProofOutput[] memory);
function verifyTransferValidity(bytes[] calldata proofs)
    external view returns (TransferValidityProofOutput[] memory);
```

Each proof is `dataHash || ECDSA(authority signs "PREIMAGE" || dataHash || authority)` (or the `"TRANSFER"` variant). Production swaps the ECDSA witness for a TDX/SGX/ZKP attestation — the contract interface stays identical.

### AgentNFT (`contracts/src/AgentNFT.sol`)

0G's official `eip-7857-draft` reference, non-upgradeable variant. We deploy it unchanged. Key entrypoints we exercise: `mint(bytes[] proofs, string[] descriptions, address to)`, `authorizeUsage(uint256 tokenId, address user)`, `transfer(address to, uint256 tokenId, bytes[] proofs)`.

### ZGUSD (`contracts/src/ZGUSD.sol`)

A native ERC-20 + EIP-3009 + EIP-712 stablecoin we deployed on 0G Galileo so the entire x402 flow stays on one chain. EIP-712 domain: `name="ZG-USD"`, `version="2"`, `decimals=6`. The TYPEHASH is the standard EIP-3009 `TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)`. Faucet method exposed for testnet convenience.

### AmmoniteResolver (`contracts/src/AmmoniteResolver.sol`)

ENS L1 resolver on Sepolia. Static keys read from internal storage; dynamic keys revert with `OffchainLookup(this, urls, callData, callbackFn, extraData)` per EIP-3668 — wallet calls our gateway, which returns the ABI-encoded live value.

### DurinL2Registrar (`contracts/src/DurinL2Registrar.sol`)

Helper around Durin's L2 registry (`0x46f0058d5187b39c5cbdfa325637479bbfbf8a65` on Base Sepolia). Mints subnames under `aaether.eth`. The L1 setter requires `setL2Registry(bytes32 node, uint64 chainId, address registry)` — note `uint64`, not `uint256`.

---

## Event schema

`AetherEvent` is a discriminated union of five types:

```ts
InferenceEvent       { model, promptHash, outputHash, attestation: { signature, modelId, providerAddress } }
ToolCallEvent        { tool, argsHash, resultHash }
ObservationEvent     { source, contentHash }
StateMutationEvent   { key, prevValueHash, newValueHash }
MintEvent            { tokenId, contract, metadataHash }
```

Every event also has `ts` (timestamp) and `prevHash` (the keccak256 of the previous event's canonical JSON). The genesis prevHash is `0x000…0`.

```
eventHash = keccak256(prevHash || canonicalJSON(event))
```

Tampering with any event invalidates every downstream link. The whole agent history is verifiable in an O(n) walk.

The iNFT's `dataHashes[0]` is the chained Merkle root over all event root hashes — one root per agent, one chain per replay.

---

## Buyer flow — x402 + ZGUSD walkthrough

```
1. GET /report/:tokenId
   ↓
2. 402 PAYMENT-REQUIRED  +  base64-JSON header containing:
       { accepts: [{
           scheme: "exact",
           network: "16602",
           maxAmountRequired: "500000",       // 6-dec string → 0.50 ZGUSD
           asset: "0xcCd…AbfF",                // ZGUSD address
           payTo: "0x73A5…b9Eb",               // seller
           description: "Thornbury report",
           extra: { name: "ZG-USD", version: "2", decimals: 6, assetTransferMethod: "eip3009" }
       }] }
   ↓
3. Buyer's frontend parses accepts[0].
       Builds EIP-712 typed-data using the **server's** name/version/asset.
       Wallet signs TransferWithAuthorization(from, to, value, validAfter, validBefore, nonce).
   ↓
4. Buyer GET /report/:tokenId  +  PAYMENT-SIGNATURE header (base64 envelope).
   ↓
5. Server submits ZGUSD.transferWithAuthorization(...)  → settleTxHash on 0G Galileo
   Server calls agentNFT.authorizeUsage(tokenId, buyer) via Guard
       → KeeperHub workflow (fallback on 524 timeout) → authzTxHash
   Server fetches a KeeperHub audit attestation     → auditId
   ↓
6. 200 OK with { report, settleTxHash, authzTxHash, auditId }
```

Frontend reads the asset, network, and EIP-712 domain entirely from the server's challenge — there is **no hardcoded asset address, chain, or token name** anywhere in the buyer code (`frontend/src/pages/Buy.tsx`).

---

## Replay flow

```
1. Buyer reads dataHashesOf(tokenId) from AgentNFT
2. Buyer reads PublishedSealedKey events to recover their sealed master key
3. Buyer decrypts master key with their private key (ECIES on secp256k1)
4. Buyer fetches the event-log root hashes (off-chain index)
5. For each rootHash:
       download encrypted blob from 0G Storage
       decrypt with master key
       parse event
       verify prevHash links to previous frame
6. Buyer can now execute the agent's full reasoning history locally
```

The frontend's `/agent/:tokenId` page renders this as a CRT black-box recorder — frames stream onto a tape, instrumentation gauges climb, the chain integrity bar sweeps once at the end and lights up `ALL LINKS VALID`.

---

## ENS dynamic resolution

```
Anyone resolves aaether.eth (or thornbury.aaether.eth)
   ↓
AmmoniteResolver.text(node, "agent.aether.head")
   ↓ isDynamicKey ?
       no  → return static value from storage
       yes → revert OffchainLookup(this, [gatewayUrls], callData, callback, extraData)
   ↓
Wallet/browser fetches gateway/{sender}/{data}
   ↓
Ammonite gateway:
   decode (node, key)
   GET {Thornbury}/sessions/latest/head
   return ABI-encoded string(head_hash) signed for callback
   ↓
Wallet calls AmmoniteResolver.textCallback(response, extraData)
   ↓
Returns the live agent head hash
```

Static keys (ENSIP-25 binding, service endpoints) live on the Durin L2 registry; dynamic keys flow through the gateway.

---

