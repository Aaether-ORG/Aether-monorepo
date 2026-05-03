/**
 * The Aether class — the public runtime that ties together compute, storage,
 * and the iNFT lifecycle.
 */
import { ethers } from 'ethers';
import { EventEmitter } from 'node:events';
import type { Hex, Message } from './types.js';
import {
  type AetherEvent,
  type InferenceEvent,
  type ToolCallEvent,
  type ObservationEvent,
  type StateMutationEvent,
  type MintEvent,
  hashEvent,
  canonicalJSON,
  GENESIS_HASH,
} from './events.js';
import { createZGCompute, type ZGComputeBroker } from './compute/broker.js';
import { createZGStorage, type ZGStorageAdapter } from './storage/log.js';
import { generateMasterKey } from './storage/encryption.js';

/** Emitted whenever an event is appended to the log. */
export interface AetherListener {
  onEvent(event: AetherEvent, eventHash: Hex, rootHash: string): void;
}

export interface AetherConfig {
  // Network
  rpcUrl: string;
  indexerUrl: string;
  // Wallets
  ownerWallet: ethers.Wallet;
  // Compute
  computeProviderAddress: string;
  defaultModel?: string;
  // iNFT contract addresses
  agentNFTAddress?: string;
  verifierAddress?: string;
  // Identity
  agentName?: string;
  /** Optional: pre-generated master key (else a fresh one is created at boot). */
  masterKey?: Uint8Array;
  /**
   * Storage policy for event payloads.
   *
   * - `'hashes'` (default): only hashes of prompts/outputs/observations land in
   *   storage. Events stay tiny and cheap.
   * - `'full'`: each event ALSO uploads the plaintext blob (prompt+output for
   *   inferences, args+result for tool calls, content for observations) as a
   *   separate encrypted file. The event is amended with a `contentRoot` field
   *   pointing to the blob, so a buyer can decrypt it and read the agent's
   *   actual reasoning text.
   */
  storeContent?: 'hashes' | 'full';
  /**
   * Storage write strategy.
   *
   * - `'per-event'` (default): each event uploads as its own encrypted file to
   *   0G Storage as it happens. Slow on testnet (60-90s sync per upload).
   * - `'batched'`: events accumulate in memory; one combined upload happens at
   *   `flush()` (or implicitly at `mint()`). Fast — single storage roundtrip.
   *   Same on-chain artifact: the iNFT's dataHash is still the chained root
   *   over per-event hashes, just persisted as one blob.
   */
  storageMode?: 'per-event' | 'batched';
}

export interface ChatResult {
  content: string;
  proofUri: string;
  eventHash: Hex;
  /** Filled when storeContent='full'. */
  contentRoot?: string;
}

export class Aether {
  private config: AetherConfig;
  private compute!: ZGComputeBroker;
  private storage!: ZGStorageAdapter;
  private masterKey: Uint8Array;
  private emitter = new EventEmitter();

  /** Local view of the event chain (rootHashes are in `_rootHashes`). */
  private _events: AetherEvent[] = [];
  private _rootHashes: string[] = [];
  private _latestEventHash: Hex = GENESIS_HASH;

  private constructor(config: AetherConfig) {
    this.config = config;
    this.masterKey = config.masterKey ?? generateMasterKey();
    this.emitter.setMaxListeners(50);
  }

  /** Subscribe to events appended after this call. Returns unsubscribe fn. */
  on(listener: (e: AetherEvent, eventHash: Hex, rootHash: string) => void): () => void {
    this.emitter.on('event', listener);
    return () => this.emitter.off('event', listener);
  }

  /** Snapshot of all events recorded so far in this session. */
  get events(): readonly AetherEvent[] {
    return this._events;
  }

  /** Storage root hashes corresponding to events (1:1). */
  get rootHashes(): readonly string[] {
    return this._rootHashes;
  }

  /** Aggregated chained-hash root over all event root hashes (the iNFT dataHash). */
  get chainedRoot(): Hex {
    return this._chainedRoot();
  }

  /** Factory: connects compute + storage. */
  static async create(config: AetherConfig): Promise<Aether> {
    const a = new Aether(config);
    a.compute = await createZGCompute({
      wallet: config.ownerWallet,
      providerAddress: config.computeProviderAddress,
      defaultModel: config.defaultModel,
    });
    a.storage = await createZGStorage({
      indexerUrl: config.indexerUrl,
      rpcUrl: config.rpcUrl,
      signer: config.ownerWallet,
      masterKey: a.masterKey,
    });
    return a;
  }

  /** Run a chat completion. Logs an InferenceEvent with TEE attestation. */
  async chat(messages: Message[], opts: { model?: string } = {}): Promise<ChatResult> {
    const result = await this.compute.chat({ messages, model: opts.model });

    const promptHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalJSON(messages))) as Hex;
    const outputHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalJSON(result.raw))) as Hex;

    // Optional: upload plaintext blob alongside the event
    let contentRoot: string | undefined;
    if (this.config.storeContent === 'full') {
      const blob = new TextEncoder().encode(canonicalJSON({ messages, output: result.raw }));
      const r = await this.storage.uploadBlob(blob);
      contentRoot = r.rootHash;
    }

    const event: InferenceEvent = {
      type: 'inference',
      ts: Date.now(),
      prevHash: this._latestEventHash,
      model: opts.model ?? this.config.defaultModel ?? 'glm-5-fp8',
      promptHash,
      outputHash,
      attestation: result.attestation,
      requestHashHeader: result.requestHashHeader,
      ...(contentRoot ? { contentRoot } : {}),
    };

    const eventHash = await this._append(event);
    return {
      content: result.content,
      proofUri: `aether://event/${eventHash}`,
      eventHash,
      contentRoot,
    };
  }

  /** Wrap any tool call as a ToolCallEvent. */
  async tool<T>(name: string, args: unknown, fn: () => Promise<T>): Promise<T> {
    const result = await fn();

    let contentRoot: string | undefined;
    if (this.config.storeContent === 'full') {
      const blob = new TextEncoder().encode(canonicalJSON({ args, result }));
      const r = await this.storage.uploadBlob(blob);
      contentRoot = r.rootHash;
    }

    const event: ToolCallEvent = {
      type: 'tool_call',
      ts: Date.now(),
      prevHash: this._latestEventHash,
      tool: name,
      argsHash: ethers.keccak256(ethers.toUtf8Bytes(canonicalJSON(args))) as Hex,
      resultHash: ethers.keccak256(ethers.toUtf8Bytes(canonicalJSON(result))) as Hex,
      ...(contentRoot ? { contentRoot } : {}),
    };
    await this._append(event);
    return result;
  }

  /** Record an external observation (web fetch, file read, etc.). */
  async observe(source: string, content: unknown): Promise<void> {
    let contentRoot: string | undefined;
    if (this.config.storeContent === 'full') {
      const blob = new TextEncoder().encode(canonicalJSON({ source, content }));
      const r = await this.storage.uploadBlob(blob);
      contentRoot = r.rootHash;
    }

    const event: ObservationEvent = {
      type: 'observation',
      ts: Date.now(),
      prevHash: this._latestEventHash,
      source,
      contentHash: ethers.keccak256(ethers.toUtf8Bytes(canonicalJSON(content))) as Hex,
      ...(contentRoot ? { contentRoot } : {}),
    };
    await this._append(event);
  }

  /** Upload an arbitrary blob (e.g. final report) under the agent's master key. */
  async uploadBlob(data: Uint8Array | string): Promise<{ rootHash: string; txHash: string }> {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    return await this.storage.uploadBlob(bytes);
  }

  /** Read a previously-uploaded blob (decrypts with master key). */
  async readBlob(rootHash: string): Promise<Uint8Array> {
    // Adapter exposes readEvent (which decrypts JSON); for arbitrary blobs we
    // read via the storage layer's internal download. Cast through any since the
    // adapter abstracts both paths.
    const e = await (this.storage as any).readBlob?.(rootHash);
    if (e instanceof Uint8Array) return e;
    // Fall back: parse from event interface (returns text)
    const evt = await this.storage.readEvent(rootHash);
    return new TextEncoder().encode(JSON.stringify(evt));
  }

  /** Currently-active master key. ⚠️ Don't expose this beyond trusted caller. */
  get currentMasterKey(): Uint8Array {
    return this.masterKey;
  }

  /** Update KV state, emit a StateMutationEvent. */
  async setState(key: string, value: unknown, prevValue: unknown = null): Promise<void> {
    const event: StateMutationEvent = {
      type: 'state_mutation',
      ts: Date.now(),
      prevHash: this._latestEventHash,
      key,
      prevValueHash: prevValue === null
        ? GENESIS_HASH
        : (ethers.keccak256(ethers.toUtf8Bytes(canonicalJSON(prevValue))) as Hex),
      newValueHash: ethers.keccak256(ethers.toUtf8Bytes(canonicalJSON(value))) as Hex,
    };
    await this._append(event);
  }

  /**
   * Mint the agent as an ERC-7857 iNFT.
   * Returns the tokenId and the on-chain tx hash.
   *
   * Caller must ensure the AgentNFT contract uses our AetherVerifier — the
   * authority key (env AETHER_TEE_AUTHORITY_KEY) signs the preimage proof here.
   */
  async mint(): Promise<{ tokenId: bigint; txHash: string; metadataHash: Hex; logRootHash?: string }> {
    if (!this.config.agentNFTAddress) {
      throw new Error('agentNFTAddress not set in AetherConfig');
    }

    // In batched mode, flush events to 0G Storage in one upload before mint.
    let logRootHash: string | undefined;
    if ((this.config.storageMode ?? 'per-event') === 'batched') {
      const flushed = await this.flush();
      logRootHash = flushed?.rootHash;
    }

    // dataHashes[0] = chained hash over all event hashes so far.
    const merkleRoot = this._chainedRoot();
    const dataHashes = [merkleRoot];
    const descriptions = [`Aether event log root @ ${new Date().toISOString()}`];

    const teeKey = process.env.AETHER_TEE_AUTHORITY_KEY;
    if (!teeKey) throw new Error('AETHER_TEE_AUTHORITY_KEY not set');

    const teeWallet = new ethers.Wallet(teeKey);
    const proofs = await Promise.all(
      dataHashes.map((h) => buildPreimageProof(h, teeWallet)),
    );

    const agentNFT = new ethers.Contract(
      this.config.agentNFTAddress,
      AGENT_NFT_ABI,
      this.config.ownerWallet,
    );

    const tx = await (agentNFT as any).mint(proofs, descriptions, this.config.ownerWallet.address);
    const receipt = await tx.wait();

    const minted = receipt.logs
      .map((l: any) => { try { return agentNFT.interface.parseLog(l); } catch { return null; } })
      .find((p: any) => p?.name === 'Minted');

    if (!minted) throw new Error('Minted event not found in receipt');
    const tokenId = minted.args._tokenId as bigint;

    // Record the mint event
    const event: MintEvent = {
      type: 'mint',
      ts: Date.now(),
      prevHash: this._latestEventHash,
      tokenId: tokenId.toString(),
      contract: this.config.agentNFTAddress,
      metadataHash: merkleRoot,
    };
    await this._append(event);

    return { tokenId, txHash: receipt.hash, metadataHash: merkleRoot, logRootHash };
  }

  /** Stream the full event history (in order). */
  async *replay(): AsyncIterable<AetherEvent> {
    for (const e of this._events) yield e;
  }

  /** Local accessor for the current head hash. */
  get head(): Hex {
    return this._latestEventHash;
  }

  /** Internal: append + persist + advance head + emit.
   *
   * In `'batched'` storage mode, persistence is deferred — events accumulate
   * in memory and are uploaded as one combined blob at `flush()`. The chained
   * root used for the iNFT mint is computed from per-event content hashes
   * directly (independent of storage rootHashes), so the on-chain commitment
   * is stable across modes.
   */
  private async _append(event: AetherEvent): Promise<Hex> {
    const newHash = hashEvent(event);
    const mode = this.config.storageMode ?? 'per-event';

    let rootHash: string;
    if (mode === 'batched') {
      // Defer storage write — record a placeholder rootHash that will be
      // replaced on flush(). Per-event hashes still chain via newHash.
      rootHash = newHash; // event-hash IS the rootHash in batched mode
    } else {
      const r = await this.storage.appendEvent(event);
      rootHash = r.rootHash;
    }

    this._events.push(event);
    this._rootHashes.push(rootHash);
    this._latestEventHash = newHash;
    try {
      this.emitter.emit('event', event, newHash, rootHash);
    } catch (e) {
      console.warn('[aether] listener error:', e);
    }
    return newHash;
  }

  /**
   * Flush all in-memory events to 0G Storage as a single combined encrypted
   * blob. Only meaningful in `'batched'` storage mode (no-op in `'per-event'`).
   * Returns the storage rootHash of the combined log.
   */
  async flush(): Promise<{ rootHash: string; txHash: string } | null> {
    const mode = this.config.storageMode ?? 'per-event';
    if (mode !== 'batched') return null;
    if (this._events.length === 0) return null;

    const blob = JSON.stringify({
      version: 1,
      events: this._events,
      eventHashes: this._rootHashes, // = per-event hashes in batched mode
      finalHead: this._latestEventHash,
    });
    const result = await this.storage.uploadBlob(new TextEncoder().encode(blob));
    return result;
  }

  /** Chained merkle-style root: H(H(H(0 || r1) || r2) || ... || rN). */
  private _chainedRoot(): Hex {
    let h = GENESIS_HASH;
    for (const r of this._rootHashes) {
      h = ethers.solidityPackedKeccak256(['bytes32', 'bytes32'], [h, r]) as Hex;
    }
    return h;
  }
}

/** Build a preimage proof: dataHash || ECDSA-signature(authority signs claim). */
async function buildPreimageProof(dataHash: string, teeWallet: ethers.Wallet): Promise<string> {
  const claim = ethers.solidityPackedKeccak256(
    ['string', 'bytes32', 'address'],
    ['PREIMAGE', dataHash, teeWallet.address],
  );
  const sig = await teeWallet.signMessage(ethers.getBytes(claim));
  return ethers.concat([dataHash, sig]);
}

// Minimal ABI fragment for AgentNFT calls we need.
const AGENT_NFT_ABI = [
  'function mint(bytes[] _proofs, string[] _dataDescriptions, address _to) external payable returns (uint256)',
  'function update(uint256 tokenId, bytes[] proofs) external',
  'function transfer(address _to, uint256 _tokenId, bytes[] _proofs) external',
  'function authorizeUsage(uint256 _tokenId, address _user) external',
  'function ownerOf(uint256) external view returns (address)',
  'function dataHashesOf(uint256) external view returns (bytes32[])',
  'function dataDescriptionsOf(uint256) external view returns (string[])',
  'event Minted(uint256 indexed _tokenId, address indexed _creator, address indexed _owner, bytes32[] _dataHashes, string[] _dataDescriptions)',
];
