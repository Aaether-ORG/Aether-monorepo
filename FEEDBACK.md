# FEEDBACK.md

> Real friction we hit while integrating sponsor APIs into Aether (the
> replayable-mintable agent runtime on 0G). Documented as we encountered each
> issue. All claims are reproducible with our public repo + the addresses in
> our submission READMEs.

---

## KeeperHub

### What worked well
- **MCP HTTP transport** (`https://app.keeperhub.com/mcp`) is clean to integrate. Standard JSON-RPC + session ID header, well-aligned with the 2025-06-18 protocol revision.
- **Tool schemas via `tools/list`** — perfectly self-documenting. We avoided hard-coding tool names, which would have broken across version updates.
- **30 tools available** out of the box covering workflows, direct execution, protocol actions, integrations. Strong primitive coverage.
- **Validation messages from the MCP server** are precise — when we sent `chainId` as a number instead of `network` as a string, the response told us exactly which fields were missing/wrong-typed. Saved a lot of guessing.

### Friction encountered

**1. KeeperHub × 0G Galileo broadcaster hangs > 120s (Cloudflare 524) — REPRODUCIBLE BUG**

We integrated `execute_contract_call` to wrap our `authorizeUsage(uint256, address)` call on the AgentNFT contract on 0G Galileo (chain ID 16602). The call **never completes** within Cloudflare's 120s timeout window.

Reproduction:
- KeeperHub wallet: Turnkey-generated, funded with 3.3 0G
- Network: `16602` (0G Galileo testnet)
- Tool: `execute_contract_call`
- Same wallet, same MCP session, same call shape
- Result: Cloudflare 524 timeout every time

```text
Origin response timeout after 120s
zone: app.keeperhub.com
ray_id: 9f5c43f8bf8e2da8
```

**Diagnostic** — we changed only the network ID and reran:
| Network | Result | Time |
|---|---|---|
| `16602` (0G Galileo) | Cloudflare 524 timeout | >100s |
| `84532` (Base Sepolia) | Clean response with `executionId` | **539ms** |

Same call, same MCP session, same auth. Difference: the chain.

**Conclusion**: KeeperHub's broadcaster pipeline for 0G Galileo specifically is hanging before broadcast (the wallet's chain nonce stays at 0 even after multiple attempts — confirmed via direct `eth_getTransactionCount`). Best guess: pre-broadcast simulation or RPC config for 16602 doesn't return.

**Mitigation we shipped**: The Aether server now races KeeperHub against a 90s timeout and falls back to direct ethers signing on timeout. The KeeperHub wallet's private key (Turnkey-exported) is held server-side to support the fallback path. End-to-end the buyer's `authorizeUsage` tx still lands on chain — just signed by us instead of by KeeperHub. Code: `examples/thornbury/src/server.ts` lines 220-285.

**2. Turnkey wallets can be exported but not imported**

We initially wanted to use our existing 0G owner wallet inside KeeperHub for the iNFT transfer. The Turnkey integration only generates fresh wallets — no import path. We had to mint a fresh iNFT directly to the KeeperHub-generated address to get past `require(owner == msg.sender)` checks on the contract side.

Workaround: re-mint to the KeeperHub address. Worked but cost an extra 0G testnet tokens.

**3. `execute_contract_call` schema uses `network` (string) but description says "Chain ID (e.g., '1' for Ethereum)"**

The field is named `network` but the value is a chain ID as a string. Suggest renaming to `chain_id` for clarity, or accept both.

**4. Field naming inconsistency between tools**

- `execute_transfer` → `recipient_address`
- `execute_contract_call` → `contract_address`

Both are address fields. Consistency would be `recipient_address` everywhere or `to`/`from` semantic naming.

**5. 422 WALLET_NOT_CONFIGURED error is silent — no nudge to set up the wallet**

When the org has no wallet, `execute_contract_call` returns:
```json
{ "error": "No wallet configured for this organization. Create a wallet in Settings before executing transactions.", "code": "WALLET_NOT_CONFIGURED" }
```

Helpful, but `tools/list` advertises `execute_contract_call` regardless of org state. Could pre-flight by inspecting `list_integrations()` and returning a structured "wallet required" signal earlier in the protocol.

### Documentation gaps
- The exact response shape of `execute_contract_call` (success vs failed) isn't in the docs. We discovered `{executionId, status: 'failed', error: 'Contract call failed: Error(Not owner)', completedAt, network, ...}` only by triggering a deliberate revert. A schema/example reference would save users one round-trip.
- The MCP-vs-REST tradeoff isn't documented anywhere we could find. We initially built a REST workflow client before discovering MCP was the canonical path. The MCP page (`docs.keeperhub.com/ai-tools`) only mentions setup; not equivalent calls or migration paths.
- `wallet-management/turnkey` page mentions "private key export — export your key if you need to migrate" but doesn't describe the import flow (which we discovered does not exist).

### Feature requests
- **Async-friendly response on long-running broadcasts**. When KeeperHub's broadcast takes >30s, the spec should let it return `{executionId, status: 'pending'}` immediately, then poll via `get_direct_execution_status`. Currently the synchronous response contract is incompatible with Cloudflare's 100s edge timeout for slower chains.
- **Programmatic wallet provisioning via MCP**. The "must use UI" requirement breaks zero-touch deployments. A `create_wallet` MCP tool that returns address (and optional private key for self-custody) would make CI/CD setup tractable.
- **First-class chain support metadata via `list_action_schemas`**. We had to discover via experimentation that 0G Galileo accepts the chain ID but doesn't broadcast cleanly. A `supported: true | 'experimental' | 'unsupported'` flag per chain would set expectations.
- **Per-call wallet override** — currently `execute_contract_call` uses the org's default wallet. Some agent flows want different signers for different operations.

### Reproducible bugs
1. **0G Galileo broadcast timeout** — see #1 above. Repro via our `scripts/setup/test-keeperhub-transfer.ts`. Set `TEST_NETWORK=16602` (timeout) vs `TEST_NETWORK=84532` (works).
2. **`execute_contract_call` and `execute_transfer` accept inconsistent field names** for the recipient address (`contract_address` vs `recipient_address`). Doesn't break, but trips up the first request.

---

## Uniswap Developer Platform

### What worked well
- **`pay-with-any-token` skill** is a sharp insight on x402 UX — token-agnostic payments solve a real adoption barrier for agent commerce. Skill docs are clear.
- **EIP-3009 + x402 spec at `coinbase/x402/specs/schemes/exact/scheme_exact_evm.md`** is a beautiful spec — we implemented buyer-side EIP-712 signing in ~150 lines straight from it.

### Friction encountered

**1. `pay-with-any-token` is Claude-skill only — no SDK alternative**

We needed to integrate token-agnostic payment programmatically (not via a Claude/Cursor agent). The skill's logic isn't exposed as a callable library, so we had to implement EIP-3009 signing ourselves. Code: `layers/payments/src/buyer.ts`.

Suggest: ship a parallel `@uniswap/x402-pay` npm package that any TS service can `import` without an LLM in the loop.

**2. Cross-token swap step lacks a public reference**

Our buyer implementation handles the same-token EIP-3009 path cleanly (USDC→USDC). The cross-token path (DAI→USDC via Universal Router + Permit2 → x402 settlement) requires composing 3 sub-flows we couldn't find a reference impl for. We threw `CrossTokenNotImplementedError` and pointed users at the Claude skill.

A "from any ERC-20 to USDC + x402 settle in one call" reference contract or sample script would close this gap.

**3. v4 hook docs are scattered**

Building toward agent-aware liquidity (our Tessera concept), we wanted to compose `beforeSwap` reads against ERC-8004 reputation. Found hook concept docs but no end-to-end example of "hook reads external contract → adjusts fee dynamically". Would benefit from a recipe page.

### Documentation gaps
- The exact x402 EIP-712 domain (`name: "USD Coin"`, `version: "2"`) for USDC on Base Sepolia is implicit — derived from the asset's domain separator. Spelling out the verified test-asset domain in the spec would save signing-mismatch debugging.

### Feature requests
- **Server-side x402 SDK**. The spec is great; we built `layers/payments/src/x402.ts` to emit `PAYMENT-REQUIRED` and parse `PAYMENT-SIGNATURE` ourselves. A `@coinbase/x402-server` Express middleware that calls `/verify` and `/settle` for you would make the server side as easy as the client.
- **A "x402 multi-token accepts" pattern**: server advertises `accepts: [USDC@base, USDC@arbitrum, EURC@base]`, client picks. We support multiple `accepts` in our challenge parser but haven't seen a server reference doing this.
- **Batch-quote endpoint** for agent flows that need to compare prices across N pairs at once. Multi-agent rebalancing today is N round-trips.

### Reproducible bugs
- None encountered.

---

## 0G

### What worked well
- **`@0gfoundation/0g-compute-ts-sdk`** worked on the first real call once we got past the package rename (see below). OpenAI-compatible endpoint at `${endpoint}/chat/completions` is exactly what we want.
- **0G Storage `Indexer` + `MemData` + `downloadToBlob`** is a tight API — encrypt+upload, decrypt+download in 5 lines. AES-256 encryption helper inside the SDK was a delight.
- **AgentNFT (`0glabs/0g-agent-nft` eip-7857-draft)** compiles cleanly and the storage namespacing pattern is principled. We dropped the upgradeable proxy for hackathon simplicity but the source ported with zero changes.
- **TEE attestation surfaces in response headers** so we can capture them and sign them into our event log. Exactly the right shape for verifiable agent receipts.
- **The Galileo testnet faucet + chainscan + storagescan** all worked first try. Solid devex.

### Friction encountered

**1. Package rename mid-cycle from `@0glabs/0g-serving-broker` to `@0gfoundation/0g-compute-ts-sdk`**

We followed the docs and installed `@0glabs/0g-serving-broker`. After install, the package's README said "this package is renamed to `@0gfoundation/0g-compute-ts-sdk`". The deprecation shim works for plain require() but tsx's ESM loader chokes on the chunked ESM build (`'./index-33b65b9f.js' does not provide an export named 'C'`).

Workaround: switched all imports to the new package name + used `createRequire` to force CJS loading inside our ESM project.

Suggest: the deprecation shim should re-export top-level identifiers cleanly (not lazy chunks) so it survives ESM bundlers.

**2. Storage event log uploads serialize at >60s each on testnet**

A research session that produces 10 events ⇒ 10 separate `Indexer.upload()` calls, each blocking on storage-node sync. Total run time was 15-25 minutes per session. Made debugging painful — every retry was another 20 minutes.

Mitigation we shipped: Aether SDK's `storageMode: 'batched'`. Events accumulate in memory; one combined upload at `flush()` (or implicitly at `mint()`). Same on-chain commitment (chained event hash), one storage roundtrip. Drops total time from 25min → 90s.

**3. Chain ID mismatch between docs and live network**

Docs and existing examples list 0G Galileo as chain ID `16601`. The live RPC at `https://evmrpc-testnet.0g.ai` returned `16602`. We caught it via Hardhat's chainId validation (`HardhatError: HH101`); a stranger first-time user might have spent an hour on this.

Suggest: doc sweep + a one-line note on the `developer-hub` index. Or have a small deprecation alias.

**4. `bytes16 sealedKey` constraint**

ERC-7857 stores the sealed key as `bytes16` — 16 bytes. So master encryption keys are forced to AES-128 (16-byte symmetric keys), not AES-256 which is more conventional. Worked around by deriving a 32-byte storage encryption key from the 16-byte master via SHA-256 — clean enough but added a small layer of indirection users will need to re-discover.

Could the spec be `bytes` (variable-length) instead, with a sentinel for canonical encryption schemes? Or `bytes32` with a 16-byte-zero-prefixed convention?

**5. Compute ledger requires ≥3 0G to create**

Our wallet had 2.97 0G (after some other gas). Creating the ledger with 2.5 → "Minimum balance to create a ledger is 3 0G". The minimum could be lower (~0.1) or auto-scale; 3 0G is a steep onboarding floor on a testnet faucet.

**6. KV streams (`Batcher`, `KvClient`) under-documented**

The starter kit shows file uploads but not the streaming KV path. We wanted state snapshots in KV with low latency; couldn't find a runnable example. Fell back to file-uploads-with-Merkle-aggregation, which works but isn't ideal for hot state.

### Documentation gaps
- The exact OpenAI-compatible endpoint path is documented twice with different conventions: README says `${endpoint}/chat/completions`; some example code (now outdated) had `/v1/chat/completions`. We hit a 400 the first time. Authoritative answer: `${getServiceMetadata.endpoint}/chat/completions` (where the SDK pre-appends `/v1/proxy`). Worth a single-line clarifying example in the README.
- Storage Log layer (`KvClient`, append-only streams) lacks examples in `0g-storage-ts-starter-kit`.
- `0g-agent-nft`'s deploy script bundles its own verifier address — not obvious that to use a custom verifier you must override the deploy script (or post-deploy `updateVerifier()`). We worked around by deploying AgentNFT directly via our own Hardhat script.

### Feature requests
- **A 0G Storage Log adapter that batches by default** with a settable flush interval. Uploading per-event is too slow on testnet for any agent loop.
- **Lower (or waivable) Compute ledger minimum**. 3 0G is fine for production; hackathon onboarding would benefit from 0.1.
- **Sealed-key length flexibility in ERC-7857** (or guidance on AES-256 patterns under the 16-byte cap).
- **Devnet RPC versioning**. Changing chain ID 16601 → 16602 broke every wallet/integration. A "Galileo v2" namespace would have made the cutover clean.

### Reproducible bugs
- ESM bundling issue in `@0glabs/0g-serving-broker@0.7.8` deprecation shim. Repro: `import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'` under tsx → `does not provide an export named 'C'`. Fix: import from `@0gfoundation/0g-compute-ts-sdk` directly via `createRequire`.

---

## ENS

### What worked well
- **Durin** (`durin.dev` + `0xDddddDdDDD8Aa1f237b4fa0669cb46892346d22d` factory) is the cleanest L2-subname onboarding we've seen. Three clicks → L2 registry deployed → L1 resolver configured. Ten-minute path from zero to a `subname.parent.eth` on Base Sepolia.
- **ENSIP-25** binding format (`agent-registration[<registry>][<agentId>]`) is precise and easy to wire. We use it verbatim for our ERC-8004 agent ID linkage.
- **L1↔L2 setup** via Durin's `setL2Registry(node, chainId, registry)` is well-documented; once we hit our wrong-arg-order issue we found the source quickly.

### Friction encountered

**1. durin.dev "Set Registry" button errored out with "Please deploy a registry first" even though we had**

We had successfully deployed L2 Registry and the "Resolver up to date ✓" was showing. Clicking "Set Registry" returned the deploy-first message. Browser-side state issue most likely. Workaround: bypass the UI entirely — call `setL2Registry(bytes32, uint64, address)` directly on the L1 resolver. Our script: `scripts/registration/durin-set-registry.ts`.

**2. The function signature `setL2Registry` takes `(bytes32, uint64, address)` — chain ID is `uint64`, NOT `uint256`**

When we wrote our bypass script we tried `(node, registry_address, chainId_uint256)` based on the README phrasing. Got "execution reverted". Reading the source revealed the actual signature is `(node, chainId_uint64, registry_address)`. Order swapped, type narrower.

Suggest: function signature in the doc page next to the buttons. Or have the script print the signed-tx args before submission.

**3. Setting many ENS text records sequentially hits Base Sepolia public RPC rate limits (502)**

Initial subname mint was atomic (mint + setText x9 in one call via our `registerWithTexts` extension to Durin's L2Registrar template). But re-running to update records hit serial `setText` calls, and got 502s on Base Sepolia public RPC for 3 of 9.

Mitigation: re-ran after 10s with success. Suggest: Durin's template registrar should expose a `batchSetText(node, keys[], values[])` to keep updates atomic.

### Documentation gaps
- The `agent-registration[<registry>][<agentId>]` text-record key format isn't shown explicitly in the ENSIP-25 page we found. We had to derive it from the example in the ENS+ERC-8004 blog post. Spelling it out as code in the spec would help tooling authors.
- L2Registry's `setText` access control (registry owner can call directly; registrar must be approved via `addRegistrar`) isn't called out — we hit "not authorized" on the first attempt.

### Feature requests
- **`addRegistrar` from the L2Registrar template's deploy script** by default — currently the template ships, you deploy it, then have to remember to authorize it. Deploy script should accept the registry address and run both txs.
- **Wildcard CCIP-Read with live-state records via Durin's L1 resolver** — a "dynamic record" feature where the resolver hits a developer-supplied gateway URL for specified record keys. This is what our Ammonite layer attempts; Durin could support it natively.
- **Batched `setText`** on the Durin L2Registry — 9 sequential txs ≈ 30s end-to-end on Base Sepolia.

### Reproducible bugs
1. **durin.dev's "Set Registry" UI button** said "Please deploy a registry first" despite a successful prior L2Registry deploy. UI state loss on page refresh suspected. Fix locally was direct contract call.
2. (Minor) ENSIP-25 binding text-record key format not in spec page — derived from blog post.

---

## Submission summary

For graders: every claim above is reproducible with our public repo
(`https://github.com/<team>/aether`) using the addresses in our submission READMEs.
The friction we documented translated directly into shippable code:
- KeeperHub fallback: `examples/thornbury/src/server.ts` (KeeperHub primary, direct fallback)
- 0G batched storage: `sdk/src/aether.ts` `storageMode: 'batched'`
- ENS bypass setL2Registry: `scripts/registration/durin-set-registry.ts`
- x402 server-side EIP-3009 signing: `layers/payments/src/buyer.ts`
