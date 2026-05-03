# End-to-end flow

> What actually happens when you click "Run agent →" in the frontend.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Frontend (Vite at :5173)                          │
│                                                                          │
│   User clicks "Run agent →" with a question                              │
│        │                                                                 │
│        ▼                                                                 │
│   useAgent.startResearch(question)                                       │
│        │                                                                 │
│        ├─→ POST /research  (Thornbury at :3000)                         │
│        │       └→ { sessionId }                                          │
│        │                                                                 │
│        └─→ EventSource(GET /sessions/:id/events)  [SSE]                  │
│                │                                                         │
└────────────────┼─────────────────────────────────────────────────────────┘
                 │
                 │  events streamed over SSE
                 │
┌────────────────▼─────────────────────────────────────────────────────────┐
│                      Thornbury server (:3000)                             │
│                                                                          │
│   POST /research                                                         │
│        │                                                                 │
│        ▼                                                                 │
│   createThornbury({ ... })  →  Aether.create({ ... })                   │
│        │                                                                 │
│        ▼                                                                 │
│   research(question):                                                    │
│        │                                                                 │
│        ├─→ aether.tool('arxiv_search', ...)                             │
│        │       └→ ToolCallEvent  →  emit + persist                       │
│        │                                                                 │
│        ├─→ aether.observe(paperUrl, abstract)                           │
│        │       └→ ObservationEvent  →  emit + persist                    │
│        │                                                                 │
│        ├─→ aether.chat([msgs])  ← per paper                             │
│        │       │                                                         │
│        │       ▼                                                         │
│        │   ZGComputeBroker (0g-serving-broker)                           │
│        │       │                                                         │
│        │       └→ POST {endpoint}/v1/chat/completions                    │
│        │             headers: getRequestHeaders(provider, payload)       │
│        │             ← TEE-signed response                                │
│        │       │                                                         │
│        │       ▼                                                         │
│        │   InferenceEvent (with attestation) → emit + persist            │
│        │                                                                 │
│        ├─→ aether.chat([final synthesis])  → InferenceEvent             │
│        │                                                                 │
│        └─→ aether.setState('report:Q', ...)  → StateMutationEvent       │
│                                                                          │
│   Then if AGENT_NFT_ADDRESS is set:                                      │
│        │                                                                 │
│        ▼                                                                 │
│   aether.mint():                                                         │
│        │                                                                 │
│        ├─→ Build chained Merkle root over event rootHashes               │
│        ├─→ TEE worker signs preimage proof (or local signing)            │
│        ├─→ AgentNFT.mint(proofs, descriptions, owner)                    │
│        └─→ MintEvent  →  emit                                            │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                 │
                 │  every event emitted is also persisted (encrypted)
                 │
┌────────────────▼─────────────────────────────────────────────────────────┐
│                       0G Storage (testnet turbo)                          │
│                                                                          │
│   Each event:                                                            │
│     - canonicalJSON(event)                                               │
│     - AES-256 encrypted with master key (16-byte for sealedKey, but      │
│       SDK supports AES-256 for storage, AES-128 for key transfer)        │
│     - Indexer.upload(MemData, ...) → { rootHash, txHash }                │
│                                                                          │
│   Snapshot pattern: chained-hash root over rootHashes[] = the iNFT       │
│   dataHashes[0]                                                          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                 │
                 │  AgentNFT.mint produces tokenId
                 │
┌────────────────▼─────────────────────────────────────────────────────────┐
│                        0G Galileo Testnet                                │
│                                                                          │
│   AetherVerifier.verifyPreimage(proofs[]) → all valid                    │
│   AgentNFT.mint() → token minted, Minted event emitted                   │
│   chainscan-galileo.0g.ai/tx/{txHash}                                    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

       Frontend receives the mint event via SSE,
       updates UI to "iNFT minted #N" with tx link.

╔══════════════════════════════════════════════════════════════════════════╗
║                          BUYER FLOW                                       ║
╚══════════════════════════════════════════════════════════════════════════╝

   Buyer hits GET /report/:tokenId
        │
        ▼
   Server returns 402 + PAYMENT-REQUIRED header (x402 challenge)
        │
        ▼
   payWithAnyToken({ challenge, sourceToken: DAI, ... }):
        │
        ├─→ same-token? sign EIP-3009 transferWithAuthorization directly
        │
        └─→ different token?
              ↓
              Universal Router swap calldata
              ↓
              tx submitted via Guard (KeeperHub workflow with retry)
              ↓
              base64 PAYMENT-SIGNATURE returned
        │
        ▼
   Buyer re-fetches GET /report/:tokenId  with PAYMENT-SIGNATURE
        │
        ▼
   Server verifies via x402 facilitator /verify endpoint
        │
        ▼
   guardCall(agentNFT, 'authorizeUsage', [tokenId, buyerAddr])
        ├─→ KeeperHub workflow created → /workflows
        ├─→ Private routing
        ├─→ Retry with exponential backoff
        └─→ MPP fallback if chain unreachable
        │
        ▼
   Server returns the report (decrypted from 0G Storage with master key)

╔══════════════════════════════════════════════════════════════════════════╗
║                          REPLAY FLOW                                      ║
╚══════════════════════════════════════════════════════════════════════════╝

   GET /agent/:tokenId/replay
        │
        ▼
   Server returns the full event log (decrypted) + chain head
        │
        ▼
   Frontend /agent/:tokenId page:
        - streams events into the EventStream component
        - each event verified: prevHash matches hash(prev event)
        - "✓ Chain valid" shown when complete

╔══════════════════════════════════════════════════════════════════════════╗
║                    ENS DYNAMIC RESOLUTION                                 ║
╚══════════════════════════════════════════════════════════════════════════╝

   Anyone resolves thornbury.aether.eth → text record "agent.aether.head"
        │
        ▼
   AmmoniteResolver.text(node, "agent.aether.head")
        │  isDynamicKey? → YES
        ▼
   revert OffchainLookup(this, [ccipUrls], callData, callback, extraData)
        │
        ▼
   Wallet/browser calls https://gateway/{sender}/{data}
        │
        ▼
   Ammonite gateway:
        - decode (node, key)
        - GET {Thornbury}/sessions/latest/head
        - return ABI-encoded string(head_hash)
        │
        ▼
   Wallet calls AmmoniteResolver.textCallback(response, extraData)
        │
        ▼
   Returns the live agent head hash
```

---

## What's wired vs what's mocked

| Layer | Status | Notes |
|---|---|---|
| 0G Compute (`@0glabs/0g-serving-broker`) | **Real** | Production SDK calls |
| 0G Storage (`@0gfoundation/0g-ts-sdk`) | **Real** | `Indexer.upload(MemData)` |
| arxiv search | **Real** | `https://export.arxiv.org/api/query` |
| Thornbury research loop | **Real** | Calls real arxiv → real 0G Compute → real 0G Storage |
| AgentNFT mint | **Real** | Deploys 0G's reference contract; we call `mint(proofs, ...)` |
| AetherVerifier | **Real** | ECDSA-signature based; deployed to 0G Galileo |
| AmmoniteResolver | **Real** | Solidity contract with CCIP-Read; deploys to Base Sepolia |
| Ammonite gateway | **Real** | Express server reading from Thornbury backend |
| ENS Durin subname mint | **Real script** | Run `setup-subname.ts` after deploying L2 registry |
| ERC-8004 register/feedback | **Real** | Calls live Sepolia contracts |
| Frontend SSE consumption | **Real** | `EventSource` against Thornbury `/sessions/:id/events` |
| Frontend → fixture fallback | **Real** | Auto when backend unreachable |
| x402 server middleware | **Real** | Express middleware emits 402 + verifies on retry |
| x402 facilitator `/verify` call | **TODO** | Demo accepts any non-empty PAYMENT-SIGNATURE; production calls Coinbase facilitator |
| Uniswap pay-with-any-token (buyer) | **Functional but not real Universal Router calldata** | Builds the structurally correct payment claim; production swaps the inner step for the real `@uniswap/ai-pay-with-any-token` call |
| KeeperHub Guard | **Real REST client** | Exact tool/field names verify on Day 0 against live API |
| TEE worker re-encryption | **Real (signed by env key)** | Production runs inside TDX/SGX |

## Critical day-0 verification before recording demo

1. `pnpm install` — does it resolve all packages?
2. `pnpm day0` — all 10 checks GREEN
3. `pnpm e2e` — all 4 services come up cleanly
4. `pnpm e2e:demo "test question"` — completes end-to-end
5. The frontend at http://localhost:5173 connects to backend, runs research, shows event stream
6. Mint succeeds; tx visible on chainscan-galileo.0g.ai
7. Buy flow works (with mock signature)
8. Replay flow works (events stream from /agent/:tokenId/replay)
