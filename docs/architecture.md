# Aether — Architecture

## High-level

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Aether SDK (off-chain runtime)                  │
│                                                                        │
│   ┌──────────┐    ┌──────────────┐    ┌──────────────────────────┐   │
│   │  Agent   │───▶│ Event logger │───▶│ 0G Storage (encrypted)   │   │
│   │  logic   │    │  (canonical) │    │ each event = one upload  │   │
│   └────┬─────┘    └──────────────┘    └──────────────────────────┘   │
│        │                                                               │
│        ├── chat() ─────────┐                                          │
│        │                   ▼                                          │
│        │        ┌─────────────────┐    ┌──────────────────┐          │
│        │        │ Compute broker  │───▶│  0G Compute      │          │
│        │        │ wraps responses │    │  (TeeML signed)  │          │
│        │        └────────┬────────┘    └─────────┬────────┘          │
│        │                 │                       │                    │
│        │                 │  attestation captured │                    │
│        │                 └───────────────────────┘                    │
│        │                                                               │
│        ├── tool()  / observe()  / setState()                          │
│        │                                                               │
│        ▼                                                               │
│   ┌──────────────┐         ┌──────────────────────────────────────┐  │
│   │ Replay engine│         │ Mint:                                 │  │
│   │ (deterministic│         │   1. Aggregate event roots → MerkleR  │  │
│   │   fold over   │         │   2. AetherVerifier signs preimage    │  │
│   │   events)     │         │   3. AgentNFT.mint(proof, desc, to)   │  │
│   └──────────────┘         └──────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
            ┌────────────────────────────────────────┐
            │         0G Galileo Testnet              │
            │                                          │
            │  AetherVerifier (sig-based, our impl)    │
            │  AgentNFT       (0glabs reference)       │
            │  AgentNFTBeacon (proxy)                  │
            └────────────────────────────────────────┘
```

## Cross-track layers

```
                ENS via Durin + ENSIP-25 + CCIP-Read
                       (Ammonite — ENS prize)
                                │
                                ▼
              thornbury.aether.eth
                                │
                       resolves to live state
                                │
                                ▼
        ┌──────────────────────────────────────────┐
        │              AETHER CORE                  │
        │   (0G framework + 0G agents prizes)       │
        └─────────┬──────────────────────┬─────────┘
                  │                      │
                  ▼                      ▼
         Guard (KeeperHub prize)    Payments (Uniswap prize)
                  │                      │
                  ▼                      ▼
         All on-chain txs         x402 + Universal Router
         retry+private+audit      pay-with-any-token
```

## Event schema

`AetherEvent` = discriminated union:
- `InferenceEvent` — model, promptHash, outputHash, TEE attestation
- `ToolCallEvent` — tool, argsHash, resultHash
- `ObservationEvent` — source URL, contentHash
- `StateMutationEvent` — key, prev/new value hashes
- `MintEvent` — tokenId, contract, metadataHash

Each event has `prevHash` so the chain is Merkle-linked. `eventHash = keccak256(prevHash || canonicalJSON(event))`.

## Storage strategy

Each event is encrypted with the agent's 16-byte AES-128 master key, uploaded as one file via `Indexer.upload(MemData, ...)`. We maintain `rootHashes[]` locally; iNFT's `dataHashes[0]` is a chained-hash root over them.

We use AES-128 (not AES-256) because the ERC-7857 reference contract stores `bytes16 sealedKey` — meaning only 16-byte symmetric keys can be transferred via the spec.

## Mint flow

1. Agent calls `aether.mint()`
2. SDK aggregates `rootHashes[]` into chained Merkle root `R`
3. SDK builds preimage proof: `dataHash(R) || ECDSA(authority signs "PREIMAGE" || R || authority)`
4. SDK calls `AgentNFT.mint([proof], ["Aether event log root @timestamp"], owner)`
5. Receipt has `Minted` event with tokenId
6. Local event log records `MintEvent`

## Transfer flow

1. New owner publishes their pubKey via off-chain signal
2. TEE worker `/reencrypt` decrypts old `sealedKey` to recover master key, re-encrypts for new owner → `newSealedKey`
3. TEE worker `/sign/transfer` signs `(oldHash, newHash, receiver, newSealedKey, authority)` claim
4. SDK calls `AgentNFT.transfer(receiver, tokenId, [proof])`
5. AetherVerifier verifies signature; AgentNFT updates owner + emits `PublishedSealedKey`
6. New owner reads sealedKey from event, decrypts master key, can now read every event in the log

## Replay flow

1. Buyer reads `dataHashesOf(tokenId)` from AgentNFT
2. Buyer reads `PublishedSealedKey` events to get their sealed master key
3. Buyer decrypts master key with their private key
4. Buyer fetches the event-log root hashes (off-chain index)
5. For each rootHash: download encrypted blob from 0G Storage, decrypt with master key, parse event
6. Buyer verifies chain integrity via `prevHash` links
7. Buyer can now execute the agent's full history locally
