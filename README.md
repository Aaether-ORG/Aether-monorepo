# Aether

> Replayable, mintable agent runtime on 0G. Every action a content-addressed event in 0G Storage; every inference TEE-attested via 0G Compute; agent identity transferable via ERC-7857 iNFTs.

## What this is

Existing standards (ERC-7857, ERC-8004) define how agents are *named* and *owned*, but neither defines what an agent *is*. Aether adds the missing primitive: the agent's own life history, content-addressed and replayable, written into 0G Storage and frozen as a mintable iNFT.

## Tracks targeted (ETHGlobal OpenAgents)

| Track | Sponsor | Submission |
|---|---|---|
| Best Agent Framework | 0G | Aether runtime + AetherVerifier (this repo) |
| Best Autonomous Agents/iNFTs | 0G | Thornbury research agent (`examples/thornbury`) |
| Best ENS for AI Agents | ENS | Ammonite layer (`layers/ammonite`) |
| Best Use of KeeperHub | KeeperHub | Guard layer (`layers/guard`) |
| Best Uniswap API | Uniswap | Token-agnostic settlement (`layers/payments`) |

## Quick start

```bash
# Install
pnpm install

# Copy env, fill in keys
cp .env.example .env
$EDITOR .env

# Run Day-0 verification (run BEFORE building anything)
pnpm day0
```

## Architecture

See `../docs/architecture.md`.

## Project layout

```
aether/
├── contracts/        Smart contracts (Hardhat)
│   ├── src/
│   │   ├── AetherVerifier.sol
│   │   └── interfaces/
│   └── scripts/
├── sdk/              The Aether runtime SDK (TypeScript)
│   └── src/
│       ├── aether.ts        Public Aether class
│       ├── events.ts        Event types + hashing
│       ├── compute/         0G Compute broker wrapper
│       ├── storage/         0G Storage adapter (encryption + log)
│       ├── replay/          Deterministic replay engine
│       └── erc8004/         ERC-8004 client
├── frontend/         Vite + React + Tailwind demo UI
│   └── src/
│       ├── pages/           Home, Agent (replay), Buy (x402), Architecture
│       ├── components/      EventStream, EventCard, WalletButton, ...
│       └── hooks/           useAgent (drives the demo flow)
├── services/
│   └── tee-worker/   TEE proof signer (dev: Node.js; prod: TDX)
├── layers/
│   ├── ammonite/     ENS dynamic agent cards (CCIP-Read gateway)
│   ├── guard/        KeeperHub workflow wrapper
│   └── payments/     x402 + Uniswap pay-with-any-token
├── examples/
│   └── thornbury/    Self-financing research agent
├── scripts/
│   └── day0/         Day-0 verification scripts
├── submissions/      Per-track submission READMEs
└── docs/             architecture.md + demo-script.md
```

## Run all services for the demo

**Single command** — boots all four services in parallel with prefixed/colored logs:

```bash
pnpm e2e
```

This brings up:

| Service | URL |
|---|---|
| Frontend (Vite) | http://localhost:5173 |
| Thornbury server | http://localhost:3000 |
| TEE worker | http://localhost:4000 |
| Ammonite CCIP-Read gateway | http://localhost:8080 |

Then drive a complete end-to-end research → mint → buy → replay pass:

```bash
pnpm e2e:demo "Your research question"
```

Or run each service manually:

```bash
pnpm frontend:dev          # http://localhost:5173
pnpm thornbury:server      # http://localhost:3000
pnpm tee:start             # http://localhost:4000
pnpm ammonite:gateway      # http://localhost:8080
pnpm thornbury:research "Your question"
```

For details of what the end-to-end flow actually does, see `docs/end-to-end-flow.md`.

## Deployments

After first deploy, addresses are written to `deployments/0g-galileo.json` (committed) and `.env` (not committed).

## Safety

- This is hackathon code. Do not use unaudited contracts on mainnet.
- The `AetherVerifier` is a signature-based stand-in; production must use a real TEE/ZKP verifier.
- Encryption is AES-128 (16-byte master key, matching ERC-7857 `bytes16` sealedKey).

## License

MIT.
