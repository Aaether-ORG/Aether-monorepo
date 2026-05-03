/**
 * Aether event schema.
 *
 * Every agent action is appended to a content-addressed log on 0G Storage.
 * Each event carries `prevHash` so the chain is Merkle-linked: any rewrite is detectable.
 *
 * `eventHash = keccak256( prevHash || canonicalJSON(eventWithoutPrevHash) )`
 */
import { keccak256, toUtf8Bytes, getBytes, hexlify } from 'ethers';
import type { Hex } from './types.js';

export type EventType =
  | 'inference'
  | 'tool_call'
  | 'observation'
  | 'state_mutation'
  | 'mint';

export interface BaseEvent {
  type: EventType;
  ts: number;
  prevHash: Hex;
}

export interface InferenceEvent extends BaseEvent {
  type: 'inference';
  model: string;
  promptHash: Hex;
  outputHash: Hex;
  attestation: TEEAttestation;
  requestHashHeader?: string;
  /** Optional: 0G Storage root for the plaintext prompt+output blob (storeContent='full'). */
  contentRoot?: string;
}

export interface ToolCallEvent extends BaseEvent {
  type: 'tool_call';
  tool: string;
  argsHash: Hex;
  resultHash: Hex;
  /** Optional: 0G Storage root for the plaintext args+result blob (storeContent='full'). */
  contentRoot?: string;
}

export interface ObservationEvent extends BaseEvent {
  type: 'observation';
  source: string;
  contentHash: Hex;
  /** Optional: 0G Storage root for the plaintext content blob (storeContent='full'). */
  contentRoot?: string;
}

export interface StateMutationEvent extends BaseEvent {
  type: 'state_mutation';
  key: string;
  prevValueHash: Hex;
  newValueHash: Hex;
}

export interface MintEvent extends BaseEvent {
  type: 'mint';
  tokenId: string; // bigint serialized to string
  contract: string;
  metadataHash: Hex;
}

export type AetherEvent =
  | InferenceEvent
  | ToolCallEvent
  | ObservationEvent
  | StateMutationEvent
  | MintEvent;

export interface TEEAttestation {
  /** TEE worker's signature over the response (TeeML) or cert fingerprint (TeeTLS). */
  signature: Hex;
  /** Optional cert fingerprint for TeeTLS providers. */
  certFingerprint?: Hex;
  /** Model identifier reported by the provider (e.g. "glm-5-fp8"). */
  modelId: string;
  /** Provider address (for billing settlement and reputation). */
  providerAddress: string;
  /** Raw response headers, captured opaquely (the parsing varies per provider). */
  rawHeaders?: Record<string, string>;
}

/**
 * Canonical JSON: keys sorted, no whitespace. Required for deterministic hashing.
 */
export function canonicalJSON(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalJSON).join(',') + ']';
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + canonicalJSON((obj as Record<string, unknown>)[k]))
      .join(',') +
    '}'
  );
}

/**
 * Compute the chained hash of an event.
 * `prevHash` is XORed into the hash so any rewrite invalidates downstream links.
 */
export function hashEvent(event: AetherEvent): Hex {
  const { prevHash, ...rest } = event;
  const canonical = canonicalJSON(rest);
  // eventHash = keccak256( prevHash bytes || canonical bytes )
  const prevBytes = getBytes(prevHash);
  const restBytes = toUtf8Bytes(canonical);
  const concat = new Uint8Array(prevBytes.length + restBytes.length);
  concat.set(prevBytes, 0);
  concat.set(restBytes, prevBytes.length);
  return keccak256(hexlify(concat)) as Hex;
}

/** Sentinel used as the prevHash for the first event in an agent's life. */
export const GENESIS_HASH: Hex = ('0x' + '00'.repeat(32)) as Hex;
