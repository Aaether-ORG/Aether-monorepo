# Aether — 0G Best Agent Framework Submission

> **Track**: 0G Best Agent Framework, Tooling & Core Extensions ($7,500 prize pool)

## Project name

**Aether: Replayable, Mintable Agent Runtime for 0G**

## Short description

Aether turns every agent action into a content-addressed event in 0G Storage; freezes the agent as ERC-7857 iNFT; verifies every inference with 0G Compute TEE attestation. Built on top of 0G's official `0glabs/0g-agent-nft` reference contracts, with a custom `AetherVerifier` for hackathon dev (production swaps in real TEE/ZKP).

## Why this is framework-level work

We don't ship "another agent." We ship the **runtime substrate** every other agent on 0G needs:
1. Typed event schema (`InferenceEvent`, `ToolCallEvent`, `ObservationEvent`, `StateMutationEvent`, `MintEvent`)
2. Drop-in SDK that captures TEE attestation from 0G Compute on every inference call
3. `replay()` engine that deterministically reconstructs agent state from any past timestamp
4. iNFT mint flow that aggregates the event log root into ERC-7857's `dataHashes`

## Contract addresses (0G Galileo testnet)

| Contract | Address |
|---|---|
| AetherVerifier | `0x...` (filled after deploy) |
| AgentNFT (proxy) | `0x...` (filled after deploy) |
| AgentNFTBeacon | `0x...` (filled after deploy) |

## Public GitHub repo

`https://github.com/<your-team>/aether`

## Demo video

`<3-min YouTube link>`

## Live demo

`https://aether-demo.vercel.app`

## Protocol features used

- **0G Storage** (`@0gfoundation/0g-ts-sdk`) — encrypted event log + state snapshots
- **0G Compute** (`@0glabs/0g-serving-broker`) — sealed inference (TeeML) with attestation capture; default model `glm-5-fp8`
- **0G Chain** — EVM deployment of AetherVerifier + AgentNFT
- **ERC-7857** via `0glabs/0g-agent-nft` reference (eip-7857-draft branch)

## Architecture

See `docs/architecture.md` and `docs/architecture-diagram.png`.

## Working example agent

`examples/thornbury/` — self-financing research agent (also submitted to 0G Agents track).

## Setup instructions

```bash
git clone https://github.com/<team>/aether
cd aether
pnpm install
cp .env.example .env  # fill in keys
pnpm day0             # verify all primitives reachable
cd contracts && pnpm compile && pnpm test && pnpm deploy:zg
```

## Team

| Name | Role | Telegram | X |
|---|---|---|---|
| (P1) | Contracts | @... | @... |
| (P2) | SDK | @... | @... |
| (P3) | Agent / integrations | @... | @... |
| (P4) | Frontend / demo | @... | @... |
