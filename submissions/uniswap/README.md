# Aether Payments — Uniswap Best API Submission (opportunistic)

> **Track**: Uniswap Best API Integration ($5,000)
> **FEEDBACK.md**: required and present at repo root

## Project name

**Aether Payments: Server-side x402 envelope for Uniswap pay-with-any-token**

## Short description

The Uniswap `pay-with-any-token` plugin is brilliant — but it's client-only. x402 servers today demand specific tokens. We ship the server-side counterpart: a tiny Express middleware that emits x402 challenges advertising a list of acceptable tokens, then routes the buyer's chosen ERC-20 through Uniswap's Universal Router for atomic swap-and-pay.

## Why Uniswap engineers will care

This is the missing primitive that makes pay-with-any-token *actually adoptable* by agent endpoints. Without it, every x402 server has to write its own challenge encoder and network whitelist. We standardize the envelope.

## Demo

A buyer holding DAI on Sepolia hits Thornbury's `/report/:tokenId` endpoint. Server returns 402 with multi-token challenge. Client calls `payWithAnyToken({ challenge, sourceToken: DAI, ... })`. Universal Router atomically swaps DAI → USDC on Base Sepolia, settles via x402, server returns the report.

## Protocol features used

- **Uniswap pay-with-any-token** plugin (from `Uniswap/uniswap-ai`)
- **Universal Router** for the actual swap
- **x402** (`@coinbase/x402-express`) for the 402 envelope

## Files

- `layers/payments/src/x402.ts` — challenge envelope helpers
- `layers/payments/src/buyer.ts` — buyer-side facade calling pay-with-any-token

## FEEDBACK.md

See `FEEDBACK.md` (Uniswap section) at repo root. Real pain points:
- Permit2 + agent-signed payloads
- Universal Router calldata complexity
- pay-with-any-token client-side only (this is what we filled)
- Trading API rate limits

## Team

(see root submission)
