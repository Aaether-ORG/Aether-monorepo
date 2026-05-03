# Ammonite — ENS Best Integration for AI Agents Submission

> **Track**: ENS Best ENS Integration for AI Agents ($2,500)

## Project name

**Ammonite: Live ERC-8004 + ENSIP-25 agent cards via dynamic CCIP-Read**

## Short description

Resolving `thornbury.aether.eth` returns a *live* agent card — model version, uptime, latest event hash — pulled from 0G Storage at resolve-time. Static records (ENSIP-25 binding to ERC-8004 agent ID, service endpoints) live on a Durin L2 registry; dynamic records flow through our CCIP-Read gateway.

## What's novel

ENSIP-25 standardizes the *binding* between ENS and ERC-8004 — a single text record. Phala's TEE agent serves a static `agent.json`. **Neither lets you ask ENS what an agent is doing right now.** Ammonite is the missing layer: live agent state surfaced via standard ENS resolution to any client (browser, wallet, MCP, AXL).

## ENS does real work — not cosmetic

- ENSIP-25 binding text record (`agent-registration[<registry>][<agentId>]`) verifies the agent on Sepolia ERC-8004 IdentityRegistry (`0x8004A818BFB912233c491871b3d84c89A494BD9e`)
- Service discovery: `agent.services.x402`, `agent.services.mcp` resolve to live endpoints
- Live runtime state: `agent.aether.head`, `agent.uptime.last24h`, `agent.model.version` change between resolutions

## Demo: no hardcoded values

Resolve `thornbury.aether.eth` three times during the demo → each resolution returns the latest `agent.aether.head` directly from the agent's running event log on 0G Storage.

## Live demo

`<demo URL>`

## Protocol features used

- **ENS**: text records, wildcard resolution (ENSIP-10), CCIP-Read (EIP-3668)
- **Durin** L2 subname factory: `0xDddddDdDDD8Aa1f237b4fa0669cb46892346d22d` (Base Sepolia)
- **L1 ENS resolver** for Durin: `0x8A968aB9eb8C084FBC44c531058Fc9ef945c3D61`
- **ENSIP-25**: ERC-8004 binding text record format
- **0G Storage KV**: dynamic agent state pulled at resolve-time

## Files

- `layers/ammonite/src/records.ts` — record schema, ENSIP-25 key construction, dynamic-key set
- `layers/ammonite/gateway/api/server.ts` — CCIP-Read gateway
- `layers/ammonite/scripts/setup-subname.ts` — Durin minting + record setup

## Team

(see root submission)
