# Aether — Pitch script for the 0G team

> Read out loud. Pause where marked. Don't sprint.

---

## 30-SECOND ELEVATOR (if they're rushed)

"Aether is a runtime layer on top of your AgentNFT reference. We turn every agent action — every inference, every tool call, every observation — into a content-addressed event in 0G Storage, capture the TEE attestation from 0G Compute, and freeze the agent's complete history as an ERC-7857 iNFT. You don't just transfer a static character.json — you transfer a replayable being. We deploy your `0glabs/0g-agent-nft` contract unchanged, add an `AetherVerifier` for the proof flow, and ship a working example agent — Thornbury — that does real research using `glm-5-fp8`, mints its findings, and sells them via x402. Live on Galileo testnet."

---

## 2-MINUTE PITCH (the one to deliver)

**[hook]**

"You shipped ERC-7857. You shipped sealed inference. You shipped 0G Storage with KV and Log. **The piece nobody has built on top of all three** is the thing we built. It's called Aether."

*(pause)*

**[the problem]**

"Right now if I mint an agent on 0G, what I'm minting is a snapshot. A character.json. Maybe some weights. The buyer gets a clone — not a being. There's no record of what the agent has done, no proof of what model it ran, no way to replay its decisions."

"That's a *huge* gap for anyone who wants to actually buy, sell, regulate, insure, or audit AI agents on-chain. And that's the whole reason ERC-7857 exists."

**[the solution]**

"Aether is the runtime that closes that gap. Three claims:"

"**One — replayable.** Every agent action is appended as a content-addressed event to 0G Storage. Each event has a `prevHash` field, so the whole life is a Merkle chain. Tamper with any event, the chain breaks."

"**Two — verifiable.** Every inference call goes through 0G Compute. We capture the TeeML attestation from the response headers and write it into the event log. Anyone can verify: this answer came from `glm-5-fp8`, inside a TEE, at this timestamp."

"**Three — ownable.** When the agent's done, we collapse all those event hashes into one Merkle root. That's the `dataHashes[0]` on your AgentNFT reference contract. We don't fork your contracts — we deploy them unchanged, point them at our `AetherVerifier`, and mint."

*(pause)*

**[proof it's real]**

"And we shipped a working agent on it: Thornbury. It searches arxiv for real, summarizes papers via `glm-5-fp8`, synthesizes a final report, mints the report as an iNFT, and sells access for fifty cents over x402. Closed economic loop. Buyers can `authorizeUsage` and *replay the agent's life* — verify every paper it read, every model call it made, every reasoning step."

"Ship it on Galileo today. Fork `0glabs/0g-agent-nft`. Add `AetherVerifier`. Use the SDK. Done."

*(pause)*

**[the close]**

"You said you wanted frameworks that other 0G builders will adopt. This is the bookkeeping layer every agent on 0G is going to need — for compliance, for resale, for insurance, for trust. We're not competing with your stack. We're the missing primitive that makes the rest of it commercially viable."

---

## 3-MINUTE VERSION (deeper if they ask)

After the 2-minute pitch ends, if they ask "how does it actually work":

"Quickly — three pieces."

"**Backend.** Thornbury server runs the agent. Each step in the research loop calls into the Aether SDK. `aether.tool('arxiv_search')` records a `ToolCallEvent`. `aether.observe(paperUrl, abstract)` records an `ObservationEvent`. `aether.chat([messages])` calls 0G Compute via your `@0glabs/0g-serving-broker`, captures the TEE-signed response headers, and persists an `InferenceEvent` with the attestation."

"Each event is canonical-JSON encoded, AES-encrypted with the agent's master key, and uploaded to 0G Storage. The SDK keeps the event hash chain locally and broadcasts each event over Server-Sent Events to the frontend."

"**Mint.** When the agent finishes a session, the SDK builds a chained Merkle root over all event root hashes. The TEE worker signs a preimage proof. We call `AgentNFT.mint(proofs, descriptions, owner)`. Token gets minted on Galileo. The full event log is verifiable from the iNFT."

"**Replay.** When a buyer pays via x402 — Uniswap pay-with-any-token routes their token to USDC — the server calls `authorizeUsage(tokenId, buyerAddr)` through KeeperHub for retry guarantees. Buyer hits the replay endpoint. They walk the event chain, decrypt each event, reconstruct the agent's full reasoning."

"Two cross-track plays on top: ENS via `agent-registration[<registry>][<agentId>]` per ENSIP-25, and a CCIP-Read gateway that returns *live* agent state — current model, latest event hash, uptime — pulled from 0G Storage at resolve time."

---

## EXPECTED QUESTIONS + ANSWERS

**Q: Are you forking our reference contracts?**
A: "No. We deploy `0glabs/0g-agent-nft` from your eip-7857-draft branch verbatim. Our only contract is `AetherVerifier` — it implements your `IERC7857DataVerifier` interface using ECDSA signatures from a designated authority. For the hackathon that authority is a Node.js process; production swaps it for a real TDX worker."

**Q: How do you handle the `bytes16` sealed key constraint?**
A: "We use AES-128 for the master key — exactly 16 bytes. Sealing happens via ECIES on secp256k1: ECDH between authority and recipient, hash to 16 bytes, XOR-encrypt the master key. Result fits the spec exactly. We documented the limit; production teams who need AES-256 will need ERC-7857 to grow the field."

**Q: Why event sourcing — isn't that just a logging pattern?**
A: "Event sourcing as a *concept* is well known — Akka, Confluent. But binding it to (a) 0G Storage as the persistence layer, (b) sealed inference attestation per event, and (c) iNFT mint as the snapshot — that combination is what's new. Each piece is your stack. We just stitched them."

**Q: What's the demo?**
A: "Run `pnpm e2e`. All four services come up. Click run on the frontend with a real research question. Watch the events stream in — observation, tool call, inference. Watch the mint go on chain. Click replay. The buyer flow uses x402 + Uniswap pay-with-any-token. The whole stack lights up."

**Q: How long did it take?**
A: "Built end-to-end during the hackathon. Real arxiv search, real `glm-5-fp8` inference via your broker, real `Indexer.upload` for storage, real mint via your AgentNFT, real x402 paywall, real CCIP-Read gateway. About 130 files, 5 services, 5 prize tracks targeted."

**Q: What's the business case?**
A: "Three. One — agent insurance: SLA payouts need an oracle of what the agent actually did. We are that oracle. Two — agent resale: buyers want provenance, not just keys. Three — compliance: regulators are coming for AI; replayable agents are auditable agents. All three need the missing primitive we shipped."

**Q: Why did you pick 0G specifically?**
A: "Because you're the only stack where this is *possible*. Sealed inference + on-chain storage + iNFT ownership + EVM in one place. Try doing this with OpenAI + S3 + Ethereum mainnet — you can't, the pieces don't compose. 0G is the only stack where the agent's life can be a single coherent verifiable artifact."

---

## WHAT TO HAVE OPEN ON YOUR LAPTOP

1. The frontend at http://localhost:5173 — running a research session live
2. The chainscan-galileo tab — showing your latest mint tx
3. The storagescan-galileo tab — showing the encrypted event blobs
4. The repo on GitHub — README + `submissions/0g-framework/README.md` + `docs/end-to-end-flow.md`

If they want to see the code:
- `contracts/src/AetherVerifier.sol` (the only contract we wrote)
- `sdk/src/aether.ts` (the runtime SDK)
- `examples/thornbury/src/agent.ts` (the example agent)

---

## DON'TS

- Don't apologize for anything missing.
- Don't say "we wanted to but didn't have time."
- Don't speed-read. Pause for 200ms between paragraphs.
- Don't read the bullet points word-for-word — internalize the message.
- Don't start with "so basically." Start with the hook.

---

## THE ONE THING TO LEAVE THEM WITH

> "We are the bookkeeping layer every agent on 0G is going to need."

If they remember nothing else — that line plants the flag.
