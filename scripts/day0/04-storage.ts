/**
 * Day 0 — Check 4: 0G Storage upload + download roundtrip.
 */
import { ethers } from 'ethers';
import { env, ok, fail, info, heading } from './_lib.js';
import { randomBytes } from 'node:crypto';

async function main() {
  heading('Day-0 Check 4: 0G Storage roundtrip');

  const { Indexer, MemData } = await import('@0gfoundation/0g-ts-sdk');

  const provider = new ethers.JsonRpcProvider(env('ZG_RPC_URL'));
  const wallet = new ethers.Wallet(env('ZG_TESTNET_PRIVATE_KEY'), provider);
  const indexer = new Indexer(env('ZG_INDEXER_RPC_URL'));

  // Random payload so we know cache hits don't fool us.
  const payload = `aether-day0-${Date.now()}-${randomBytes(8).toString('hex')}`;
  const data = new TextEncoder().encode(payload);
  const memData = new MemData(data);

  // 0G Storage's AES-256 path needs a 32-byte key. Our SDK derives one from
  // the 16-byte master key (sha256). For this isolated check, generate 32 bytes.
  const masterKey = randomBytes(32);

  info(`Uploading ${data.length} bytes (encrypted)...`);
  const [tx, errUp] = await indexer.upload(memData, env('ZG_RPC_URL'), wallet as any, {
    encryption: { type: 'aes256', key: Buffer.from(masterKey) } as any,
  });
  if (errUp !== null) {
    fail(`Upload error: ${errUp}`);
    process.exit(1);
  }

  const rootHash = (tx as any).rootHash ?? (tx as any).rootHashes?.[0];
  ok(`Uploaded. rootHash = ${rootHash}`);
  info(`Storage explorer: ${env('ZG_STORAGE_EXPLORER')}/tx/${(tx as any).txHash ?? (tx as any).txHashes?.[0]}`);

  info('Downloading + decrypting...');
  const [blob, errDl] = await indexer.downloadToBlob(rootHash, {
    decryption: { symmetricKey: Buffer.from(masterKey) },
  } as any);
  if (errDl !== null) {
    fail(`Download error: ${errDl}`);
    process.exit(1);
  }

  const text = await blob.text();
  if (text !== payload) {
    fail(`Roundtrip mismatch: uploaded "${payload}", downloaded "${text}"`);
    process.exit(1);
  }
  ok('Roundtrip OK.');
}

main().catch((e) => {
  fail(e.message);
  process.exit(1);
});
