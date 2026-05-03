/**
 * Aether TEE Worker
 *
 * In production this runs inside an Intel TDX or AWS Nitro enclave with
 * hardware attestation. For the hackathon, it runs as a normal Node.js
 * process holding the authority key.
 *
 * Responsibilities:
 *   - Sign preimage proofs for `mint()`
 *   - Re-encrypt master keys + sign transfer proofs for `transfer()`
 *
 * Exposes a tiny HTTP API (POST /sign/preimage, POST /sign/transfer) so the
 * SDK can request signatures without holding the authority key directly.
 */
import 'dotenv/config';
import { ethers } from 'ethers';
import { createServer } from 'node:http';
import { sealKey, openKey, publicKeyFromPrivate, generateMasterKey } from '@aether/sdk';
type Hex = `0x${string}`;

const PORT = Number(process.env.TEE_WORKER_PORT ?? 4000);
const AUTHORITY_KEY = process.env.AETHER_TEE_AUTHORITY_KEY;
if (!AUTHORITY_KEY) throw new Error('AETHER_TEE_AUTHORITY_KEY required');

const wallet = new ethers.Wallet(AUTHORITY_KEY);
console.log(`[tee-worker] authority address: ${wallet.address}`);

createServer(async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.writeHead(405).end('POST only');
      return;
    }

    const body = await readBody(req);
    const json = JSON.parse(body);

    if (req.url === '/sign/preimage') {
      // body: { dataHash }
      const claim = ethers.solidityPackedKeccak256(
        ['string', 'bytes32', 'address'],
        ['PREIMAGE', json.dataHash, wallet.address],
      );
      const sig = await wallet.signMessage(ethers.getBytes(claim));
      const proof = ethers.concat([json.dataHash, sig]);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ proof }));
      return;
    }

    if (req.url === '/sign/transfer') {
      // body: { oldDataHash, newDataHash, receiver, sealedKey }
      const claim = ethers.solidityPackedKeccak256(
        ['string', 'bytes32', 'bytes32', 'address', 'bytes16', 'address'],
        ['TRANSFER_VALIDITY', json.oldDataHash, json.newDataHash, json.receiver, json.sealedKey, wallet.address],
      );
      const sig = await wallet.signMessage(ethers.getBytes(claim));
      const proof = ethers.concat([
        json.oldDataHash,
        json.newDataHash,
        ethers.zeroPadValue(json.receiver, 20),
        json.sealedKey,
        sig,
      ]);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ proof }));
      return;
    }

    if (req.url === '/reencrypt') {
      // body: { oldSealedKey, oldOwnerPubKey, newOwnerPubKey }
      // Returns { newSealedKey } — re-seals the master key for the new recipient
      const masterKey = openKey(json.oldSealedKey, AUTHORITY_KEY as Hex, json.oldOwnerPubKey);
      const newSealedKey = sealKey(masterKey, json.newOwnerPubKey, AUTHORITY_KEY as Hex);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ newSealedKey }));
      return;
    }

    if (req.url === '/seal/new') {
      // body: { recipientPubKey } — generate fresh master key + seal for recipient
      const masterKey = generateMasterKey();
      const sealedKey = sealKey(masterKey, json.recipientPubKey, AUTHORITY_KEY as Hex);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        sealedKey,
        // CAUTION: returning master key is only OK if caller is trusted (the agent owner).
        masterKey: ethers.hexlify(masterKey),
      }));
      return;
    }

    res.writeHead(404).end();
  } catch (e: any) {
    console.error('[tee-worker] error:', e);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
}).listen(PORT, () => {
  console.log(`[tee-worker] listening http://localhost:${PORT}`);
  console.log('  POST /sign/preimage   { dataHash }');
  console.log('  POST /sign/transfer   { oldDataHash, newDataHash, receiver, sealedKey }');
  console.log('  POST /reencrypt       { oldSealedKey, oldOwnerPubKey, newOwnerPubKey }');
  console.log('  POST /seal/new        { recipientPubKey }');
});

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
