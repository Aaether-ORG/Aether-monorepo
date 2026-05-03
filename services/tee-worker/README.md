# @aether/tee-worker

Off-chain signer that produces ERC-7857 preimage and transfer-validity proofs.

In production: runs inside Intel TDX (Phala Cloud) or AWS Nitro Enclave with hardware attestation.
For the hackathon: runs as a normal Node.js process holding the authority key.

## Run

```bash
pnpm start
# Listens on http://localhost:4000
```

## Endpoints

- `POST /sign/preimage` — `{ dataHash }` → `{ proof }` (for AgentNFT.mint)
- `POST /sign/transfer` — `{ oldDataHash, newDataHash, receiver, sealedKey }` → `{ proof }` (for AgentNFT.transfer)
- `POST /reencrypt` — re-seals the master key for a new recipient
- `POST /seal/new` — fresh master key sealed for a recipient

The authority key (env `AETHER_TEE_AUTHORITY_KEY`) MUST match the address passed to `AetherVerifier`'s constructor.
