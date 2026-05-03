# Aether — Demo Video Shot List
*Target length: 2:55 (under 3:00 hard cap). Vertical or horizontal both fine. Voiceover or live narration.*

> **Read first**: this is the storyboard. Print it. Tape to the wall. Rehearse it three times before recording. Live demos fail; recordings are insurance.

---

## Pre-recording setup (do this 30 minutes before)

- [ ] All Day-0 checks GREEN (`pnpm day0` passed)
- [ ] Aether services running:
  - [ ] `pnpm frontend:dev` (Vite at :5173)
  - [ ] `pnpm thornbury:server` (Express at :3000)
  - [ ] `pnpm tee:start` (TEE worker at :4000)
  - [ ] `pnpm ammonite:gateway` (CCIP gateway at :8080)
- [ ] Browser: 2 tabs side-by-side (creator window, buyer window)
- [ ] Two test wallets pre-funded with 0G test tokens
- [ ] Etherscan-equivalent tab pinned to 0G chainscan-galileo
- [ ] Storage explorer tab pinned to storagescan-galileo
- [ ] `agent.aether.eth` resolved in a third tab (for ENS demo segment)
- [ ] OBS recording at 1920x1080 @ 30fps; mic test at -12dB
- [ ] Network: ethernet preferred; mobile hotspot as backup
- [ ] **Backup recording running in parallel from second laptop** (insurance)

---

## STORYBOARD

### [00:00–00:15] HOOK — "Why agents need bookkeeping"

**Screen**: Aether home page hero section.
**B-roll**: Brief cut of three news headlines: "AI agent makes wrong trade", "court rules against AI hallucination", "regulators ask: how do you audit a black box?"

**Voiceover**:
> "AI agents are going on-chain. They sign transactions. They give medical advice. They trade. But when they fail — there's no audit trail. When they succeed — there's nothing to sell. Agents today are black boxes. We fix all three: replayable, verifiable, ownable. In ninety seconds."

**Visible on screen**:
- Hero text: "Agents you can replay."
- 4 status pills: "0G Galileo Testnet", "ERC-7857 reference", "ERC-8004 (Sepolia)", "model: glm-5-fp8 (TeeML)"

---

### [00:15–00:50] CLAIM 1 — REPLAYABLE

**Screen**: Click a question preset → click "Run agent →"

**Voiceover**:
> "Watch this agent answer 'what are the most cited cell-free protein synthesis papers from Q1 2026?' Every step — fetch, summary, synthesis — appends a content-addressed event to 0G Storage. Each one carries the previous event's hash, so the whole life is a Merkle chain."

**Visible on screen**: Event cards animate in one by one:
- `observation` × 2
- `tool_call` × 1
- `inference` × 3 (each with TEE-signed pill)
- `state_mutation` × 1

**Pause point** at 00:45: hover the third inference card. The card shows the TEE pill: "TEE-signed by 0x9D40…cDe".

> "This isn't just a logged response. This is signed. Inside a hardware enclave on 0G Compute. Anyone can verify."

---

### [00:50–01:30] CLAIM 2 — VERIFIABLE

**Screen**: Stay on home page. Click any inference event card to expand (or move to a detail view).

**Voiceover**:
> "Each inference receipt names the model — `glm-5-fp8` — the prompt hash, the output hash, the provider's address, and a TeeML signature from the enclave's private key. Production verifies this against a known TEE root of trust."

**Pause point** at 01:10: switch to chainscan tab → show a transaction writing to ERC-8004's Validation Registry on Sepolia. (Optional if not yet wired.)

> "We mirror every attestation to ERC-8004's Validation Registry. The same standard ENS uses for agent identity. Now, verifiable performance is portable across every wallet, app, and chain."

---

### [01:30–02:00] CLAIM 3 — OWNABLE

**Screen**: Mint completes, "iNFT minted" card appears with token #N + tx link.

**Voiceover**:
> "The agent's full event log just collapsed into one Merkle root, signed by our verifier, and frozen as an ERC-7857 iNFT on 0G Chain. Token #1234. Encrypted state on 0G Storage. Sealed key in our wallet."

**Pause point** at 01:45: click the chainscan tx link in a new tab. Briefly show the on-chain `Minted` event.

> "Anyone can buy this iNFT. Anyone can replay it."

---

### [02:00–02:30] THE BUYER FLOW

**Screen**: Switch to Buyer window (second laptop / Incognito with second wallet). Navigate to `/buy` with token ID 1234 pre-filled.

**Voiceover**:
> "I'm now a buyer. I want to read this report. The endpoint returns 402. I hold DAI on Sepolia. The Uniswap pay-with-any-token plugin atomically swaps DAI to USDC on Base, settles via x402, and KeeperHub Guard handles the on-chain `authorizeUsage` call with private routing."

**Visible on screen**: Phase trace ticks through:
- ✓ GET /report/:id
- ✓ HTTP 402 challenge received
- ✓ Uniswap pay-with-any-token: swap DAI → USDC
- ✓ x402 settlement via facilitator
- ✓ authorizeUsage(tokenId, buyer) — with KeeperHub audit ID

Report unlocks. Show the prose.

---

### [02:30–02:50] THE REPLAY — KILLER MOMENT

**Screen**: Click "Replay" tab → `/agent/1234`.

**Voiceover**:
> "Now the part nobody else has shown. The buyer can replay the agent's life."

**Visible on screen**: Events stream in over ~6 seconds. "Verifying chain integrity…" then "✓ Chain valid. All 8 event hashes link correctly."

> "Sixty seconds of agent activity reconstructs deterministically from the log. Buyer verifies every inference, every observation, every decision. They didn't buy an answer. They bought the audit."

---

### [02:50–02:58] CLOSE

**Screen**: Cut back to home page. Aether logo. End card.

**Voiceover**:
> "Aether. The bookkeeping system every agent on 0G is going to need. Live on Galileo testnet today. Submission targets: 0G framework, 0G agents, ENS, KeeperHub. GitHub link below."

**End card** visible:
- Aether logo
- `github.com/<team>/aether`
- `@aether.eth`
- 4 prize track logos at the bottom

---

## CRITICAL DO'S AND DON'TS

**Do**
- Speak slowly. The tendency under stress is to rush.
- Pause for 200ms before each click — gives audio room to breathe.
- Keep wallet UI dialogs out of the recording flow. If MetaMask pops up, time it so the dialog is brief and visible only for ~2 seconds.
- Have the browser zoom set to 110% so judges on a phone can read.

**Don't**
- Don't read the on-screen text out loud word-for-word. The voiceover should *complement*, not duplicate.
- Don't show real production keys, addresses, or anything that could be redacted later (just don't include them).
- Don't apologize for anything. If something's missing, omit it; never narrate the gap.

---

## BACKUP MOMENTS (in order of fallback)

1. **If 0G Compute call hangs**: cut to fixture sequence in the frontend (already wired).
2. **If contract call fails**: switch to a pre-recorded clip of the mint succeeding.
3. **If wallet popup misbehaves**: skip the buyer flow segment; jump from claim 3 to replay.
4. **If everything melts**: play the pre-recorded backup video. Two laptops, two recordings — that's why.

---

## CHECKLIST: PER-TRACK FRAMING IN VOICEOVER

For each prize track, ensure the voiceover names the track's primitive at least once:

| Track | Phrase to include |
|---|---|
| 0G Framework | "every action a content-addressed event in 0G Storage" |
| 0G Agents (iNFTs) | "frozen as an ERC-7857 iNFT on 0G Chain" |
| ENS | "live ERC-8004 + ENSIP-25 agent card via dynamic CCIP-Read" |
| KeeperHub | "KeeperHub Guard handles the on-chain authorizeUsage call with private routing" |
| Uniswap | "Uniswap pay-with-any-token plugin atomically swaps DAI to USDC on Base" |

If a phrase didn't make it in, re-shoot. Judges grading by track want to hear their tech named.

---

## FINAL DAY-OF CHECKS

- [ ] All four services running (frontend, thornbury, tee, ammonite)
- [ ] Wallets pre-funded
- [ ] Browser zoom 110%
- [ ] Notifications silenced
- [ ] Backup laptop recording
- [ ] Phone in airplane mode
- [ ] One sip of water at 00:14, 01:30, 02:30 (planned)
- [ ] Take three. Pick the best. Don't keep going past four — fatigue kills delivery.
