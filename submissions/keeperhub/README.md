# Guard — KeeperHub Best Use Submission

> **Track**: KeeperHub Best Use of KeeperHub ($4,500) + Builder Feedback Bounty ($500)

## Project name

**Guard: x402-aware preventive reliability for agent commerce**

## Short description

Guard wraps any x402 server endpoint or on-chain transaction in a KeeperHub workflow with retry, gas optimization, private routing (Flashbots), and MPP fallback on terminal chain failure. Aether uses Guard for every iNFT mint, transfer, and `authorizeUsage` settlement.

## What's the gap?

- **x402r** (existing) provides reactive refunds — funds in escrow, released by arbiter after manual or automated dispute
- **KeeperHub** (existing) provides generic workflow primitives (retry, audit, private routing)
- **Nobody has stitched these together** for x402-server-specific reliability

Guard is the missing layer: drop-in middleware that turns any x402 endpoint into a managed flow with KeeperHub at the back, and x402r-style escrow only as last-resort.

## Working demo

`examples/thornbury/` uses Guard wrapping every on-chain action. The demo script triggers:
1. Normal mint settles via KeeperHub (clean audit trail)
2. Adversarial: simulated MEV → KeeperHub auto-retries with private routing → success
3. Adversarial: chain unreachable → MPP fallback → success
4. Final fallback: refund via x402r-compatible flow

## Protocol features used

- **KeeperHub MCP server** at `mcp.keeperhub.com` — `submit_transaction` workflow type
- **KeeperHub REST API** for workflow CRUD (`/workflows`)
- **KeeperHub audit trail** linked from every Aether on-chain event
- **x402** (`@coinbase/x402`) — settlement flow
- **MPP** (Stripe) — fallback path

## FEEDBACK.md

Real, actionable feedback in `FEEDBACK.md` at repo root (KeeperHub section). Pain points encountered, doc gaps, feature requests. Submitted for Builder Feedback Bounty.

## Files

- `layers/guard/src/index.ts` — Guard client
- `layers/guard/README.md` — usage examples

## Team

(see root submission)
