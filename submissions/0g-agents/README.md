# Thornbury — 0G Best Autonomous Agents/Swarms/iNFT Submission

> **Track**: 0G Best Autonomous Agents, Swarms & iNFT Innovations ($7,500 / up to 5 winners @ $1,500)

## Project name

**Thornbury: The Self-Financing Research Agent (built on Aether)**

## Short description

Thornbury picks open research questions, fetches papers, summarizes via attested 0G Compute, and **mints each report as an ERC-7857 iNFT**. Buyers pay $0.50 via x402 (Uniswap pay-with-any-token routes any ERC-20 to USDC) to unlock the report. Royalties refill the agent's 0G Compute account. **A closed economic loop on 0G.**

## What's novel

- Existing winners did *trading* (Hubble) or *paying for content* (Autonome). Thornbury closes the third corner: **agents minting their work as iNFTs and selling access via `authorizeUsage`.**
- Every inference is TEE-attested (TeeML signature captured into 0G Storage Log).
- Every report is replayable: buyers can verify which papers Thornbury read and which model produced the synthesis.

## Contract addresses (0G Galileo testnet)

| Contract | Address |
|---|---|
| AetherVerifier | `0x...` |
| AgentNFT | `0x...` |

## Minted iNFT

Token #N — `https://chainscan-galileo.0g.ai/tx/<MINT_TX>`
Encrypted blob — `https://storagescan-galileo.0g.ai/tx/<UPLOAD_TX>`

## Proof intelligence/memory is embedded

The iNFT's `dataHashes[0]` = chained Merkle root over Thornbury's full event log (inferences, tool calls, observations). The buyer's wallet calls `authorizeUsage(tokenId, buyer)` (settled via KeeperHub Guard); the buyer can then download and decrypt every event in the log via `replay()`.

## Demo video

`<3-min YouTube link>`

## Live demo

`https://thornbury.aether-demo.vercel.app`

## Protocol features used

- **0G Storage**: every event written as encrypted file via `@0gfoundation/0g-ts-sdk`
- **0G Compute**: `glm-5-fp8` and `qwen3-vl-30b` for figure summaries; TeeML attestation captured
- **0G Chain**: ERC-7857 mint, transfer, authorizeUsage
- **x402** (Coinbase): paywall on `/report/:tokenId` endpoint
- **Uniswap pay-with-any-token**: buyer-side token-agnostic settlement

## Setup

See repo root `README.md`. Run:
```bash
pnpm --filter @aether/thornbury server   # x402 paywall on :3000
pnpm --filter @aether/thornbury research "Your question"
```

## Team

(see root submission)
