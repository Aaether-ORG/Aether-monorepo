# Architecture Diagram

Render via mermaid in any GitHub README. The diagram is also embedded directly.

## System overview

```mermaid
flowchart TB
  subgraph Client[" Frontend (Vite at :5173) "]
    UI[Home / Agent / Buy / Architecture pages]
    Hook[useAgent hook<br/>SSE consumer]
    UI <--> Hook
  end

  subgraph Backend[" Thornbury server (:3000) "]
    Research[research loop]
    SSE[SSE event stream]
    X402[x402 paywall]
    Replay[replay endpoint]
  end

  subgraph SDK[" @aether/sdk "]
    Aether[Aether class]
    Compute[ZGComputeBroker]
    StorageAd[ZGStorageAdapter]
    Replay2[Replay engine]
    ERC8004[ERC-8004 client]
    Aether --> Compute
    Aether --> StorageAd
  end

  subgraph ZG[" 0G "]
    ZGCompute[(0G Compute<br/>TeeML inference)]
    ZGStore[(0G Storage<br/>encrypted event log)]
    ZGChain[(0G Chain<br/>AgentNFT + AetherVerifier)]
  end

  subgraph Layers[" Cross-track layers "]
    Guard[Guard<br/>KeeperHub workflows]
    Payments[Payments<br/>x402 + pay-with-any-token]
    Ammonite[Ammonite gateway<br/>CCIP-Read]
  end

  subgraph External[" External "]
    Arxiv[(arxiv.org)]
    KH[(KeeperHub)]
    ENS[(ENS / Durin L2)]
    Sepolia[(Sepolia ERC-8004)]
  end

  Hook -->|POST /research<br/>SSE /sessions/:id/events| Backend
  Research --> SDK
  Research --> Arxiv
  Compute --> ZGCompute
  StorageAd --> ZGStore
  Aether -->|mint via AgentNFT| ZGChain
  ERC8004 --> Sepolia

  X402 --> Guard
  Guard --> KH
  Guard -->|authorizeUsage| ZGChain

  Hook -->|/buy| Payments
  Payments -->|swap+pay| ZGCompute

  Ammonite --> Backend
  Ammonite --> ENS

  Replay --> StorageAd
```

## End-to-end demo flow

```mermaid
sequenceDiagram
  participant U as User
  participant FE as Frontend
  participant T as Thornbury server
  participant A as Aether SDK
  participant Z as 0G Compute
  participant S as 0G Storage
  participant N as AgentNFT (0G Chain)
  participant K as KeeperHub
  participant B as Buyer

  U->>FE: Click "Run agent →"
  FE->>T: POST /research { question }
  T-->>FE: { sessionId }
  FE->>T: SSE /sessions/:id/events

  loop research
    T->>A: aether.tool('arxiv_search', ...)
    A->>S: upload event (encrypted)
    S-->>A: { rootHash }
    A-->>T: ToolCallEvent
    T-->>FE: SSE event

    T->>A: aether.chat([msgs])
    A->>Z: POST /v1/chat/completions
    Z-->>A: response + TEE attestation
    A->>S: upload InferenceEvent
    S-->>A: { rootHash }
    A-->>T: InferenceEvent (with attestation)
    T-->>FE: SSE event
  end

  T->>A: aether.uploadBlob(finalReport)
  A->>S: encrypted final report blob
  S-->>A: { reportRoot }

  T->>A: aether.mint()
  A->>N: AgentNFT.mint(proofs, descriptions, owner)
  N-->>A: tokenId
  A-->>T: { tokenId, txHash, reportRoot, masterKey }
  T-->>FE: SSE { status: completed, tokenId }

  Note over B,N: --- Buyer flow ---
  B->>T: GET /report/:tokenId
  T-->>B: 402 + PAYMENT-REQUIRED
  B->>T: GET /report/:tokenId + PAYMENT-SIGNATURE
  T->>K: createWorkflow(authorizeUsage, retry)
  K->>N: AgentNFT.authorizeUsage(tokenId, buyer)
  N-->>K: ok
  K-->>T: { txHash, auditId }
  T->>S: readBlob(reportRoot, masterKey)
  S-->>T: encrypted blob → decrypted
  T-->>B: { report, auditId }

  Note over B,S: --- Replay flow ---
  B->>T: GET /agent/:tokenId/replay?fromStorage=1
  loop verify chain
    T->>S: readEvent(rootHash)
    S-->>T: decrypted event
    T->>T: verify prevHash matches hash(prev)
  end
  T-->>B: { events, chainValid, chainHead }
```

## Storage anatomy of one minted iNFT

```mermaid
graph LR
  subgraph onchain[on 0G Chain — AgentNFT #N]
    md["dataHashes[0]<br/>= chained Merkle root<br/>(bytes32)"]
    sk["sealedKey (bytes16)<br/>= ECIES-sealed master key"]
  end

  subgraph storage[on 0G Storage — encrypted with derived key]
    e1[event 1<br/>tool_call]
    e2[event 2<br/>observation]
    e3[event 3<br/>inference + TEE attestation]
    e4[event N<br/>state_mutation]
    rep[final report blob<br/>JSON: question, papers, finalReport]
  end

  subgraph offchain[off-chain]
    mk[master key<br/>16 bytes]
  end

  md --> e1
  md --> e2
  md --> e3
  md --> e4
  sk -. unsealed via ECDH .-> mk
  mk -. derive sha256 .-> StorageKey
  StorageKey -. decrypts .-> e1
  StorageKey -. decrypts .-> e2
  StorageKey -. decrypts .-> e3
  StorageKey -. decrypts .-> e4
  StorageKey -. decrypts .-> rep

  e3 --> attestation["TeeML signature<br/>provider address<br/>cert fingerprint<br/>raw headers"]
```

## Per-track contributions

```mermaid
graph TB
  Spine[Aether core<br/>= 0G Framework track]

  Spine --> A[Thornbury agent<br/>= 0G Agents track]
  Spine --> B[Ammonite resolver + gateway<br/>= ENS track]
  Spine --> C[Guard wrapper<br/>= KeeperHub track]
  Spine --> D[x402 server + buyer<br/>= Uniswap track]
  Spine --> E[FEEDBACK.md substance<br/>= KeeperHub Builder Bonus]

  classDef track fill:#7cf2c4,stroke:#3aa67d,color:#0e0e12
  class A,B,C,D,E track
```
