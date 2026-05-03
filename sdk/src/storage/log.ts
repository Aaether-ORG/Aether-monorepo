/**
 * 0G Storage adapter for Aether's event log.
 *
 * Strategy: each event = one encrypted file uploaded via `Indexer.upload(MemData, ...)`.
 * We maintain an in-memory index `(eventHash → rootHash)` so we can fetch any past event.
 * The iNFT's `dataHashes[0]` is a chained-hash root over event hashes, so the on-chain
 * commitment is just one bytes32.
 *
 * Key derivation: ERC-7857's `bytes16 sealedKey` constrains the master key to 16 bytes.
 * For 0G Storage we derive a 256-bit storage key as `sha256(masterKey || "aether-storage-v1")`.
 */
import type { ethers } from 'ethers';
import type { AetherEvent } from '../events.js';
import { canonicalJSON } from '../events.js';
import { createHash } from 'node:crypto';

export interface ZGStorageAdapter {
  /** Encrypt + upload an event; returns its content-addressed root in 0G Storage. */
  appendEvent(event: AetherEvent): Promise<{ rootHash: string; txHash: string }>;
  /** Fetch + decrypt an event by storage root. */
  readEvent(rootHash: string): Promise<AetherEvent>;
  /** Encrypt + upload an arbitrary blob (e.g. final report). */
  uploadBlob(data: Uint8Array): Promise<{ rootHash: string; txHash: string }>;
  /** Fetch + decrypt an arbitrary blob. */
  readBlob(rootHash: string): Promise<Uint8Array>;
}

export interface ZGStorageConfig {
  indexerUrl: string;
  rpcUrl: string;
  signer: ethers.Signer;
  /** 16-byte AES-128 master key, generated once per agent and sealed in iNFT. */
  masterKey: Uint8Array;
}

/** Derive a 256-bit storage key from the 16-byte master key. */
export function deriveStorageKey(masterKey: Uint8Array): Buffer {
  if (masterKey.length !== 16) {
    throw new Error(`master key must be 16 bytes for ERC-7857 sealedKey, got ${masterKey.length}`);
  }
  const h = createHash('sha256');
  h.update(Buffer.from(masterKey));
  h.update(Buffer.from('aether-storage-v1', 'utf-8'));
  return h.digest(); // 32 bytes
}

/**
 * Production-grade adapter. Lazily imports the @0gfoundation/0g-ts-sdk so the
 * SDK can be consumed in environments where the package isn't installed yet.
 */
export async function createZGStorage(config: ZGStorageConfig): Promise<ZGStorageAdapter> {
  // Dynamic import keeps the rest of the SDK testable without the storage dep.
  const { Indexer, MemData } = await import('@0gfoundation/0g-ts-sdk');
  const indexer = new Indexer(config.indexerUrl);
  const storageKey = deriveStorageKey(config.masterKey);

  async function uploadEncrypted(data: Uint8Array): Promise<{ rootHash: string; txHash: string }> {
    const memData = new MemData(data);
    const [tx, err] = await indexer.upload(memData, config.rpcUrl, config.signer as any, {
      encryption: { type: 'aes256', key: storageKey },
      // Testnet flake: storage indexer often accepts the upload tx but never
      // signals segment finalisation, blocking the SDK's polling loop forever.
      // We submit the tx, then return as soon as it's on chain — segments
      // finalise in the background without holding up the mint.
      finalityRequired: false,
    } as any);
    if (err !== null) throw new Error(`0G Storage upload failed: ${err}`);
    if ('rootHash' in (tx as any)) {
      return { rootHash: (tx as any).rootHash, txHash: (tx as any).txHash };
    }
    return { rootHash: (tx as any).rootHashes[0], txHash: (tx as any).txHashes[0] };
  }

  async function downloadDecrypted(rootHash: string): Promise<Uint8Array> {
    const [blob, err] = await indexer.downloadToBlob(rootHash, {
      decryption: { symmetricKey: storageKey },
    } as any);
    if (err !== null) throw new Error(`0G Storage download failed: ${err}`);
    const arr = new Uint8Array(await blob.arrayBuffer());
    return arr;
  }

  return {
    async appendEvent(event) {
      const json = canonicalJSON(event);
      const data = new TextEncoder().encode(json);
      return await uploadEncrypted(data);
    },

    async readEvent(rootHash) {
      const bytes = await downloadDecrypted(rootHash);
      const text = new TextDecoder().decode(bytes);
      return JSON.parse(text);
    },

    async uploadBlob(data) {
      return await uploadEncrypted(data);
    },

    async readBlob(rootHash) {
      return await downloadDecrypted(rootHash);
    },
  };
}
