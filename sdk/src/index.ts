/**
 * @aether/sdk — Replayable, mintable agent runtime for 0G.
 *
 * Public surface:
 *  - `Aether` — the runtime class (chat, tool, observe, mint, replay)
 *  - Event types and helpers
 *  - ERC-8004 client
 */
export { Aether, type AetherConfig, type ChatResult, type AetherListener } from './aether.js';
export {
  type AetherEvent,
  type InferenceEvent,
  type ToolCallEvent,
  type ObservationEvent,
  type StateMutationEvent,
  type MintEvent,
  type TEEAttestation,
  hashEvent,
  canonicalJSON,
} from './events.js';
export { encryptMaster, decryptMaster, sealKey, openKey, generateMasterKey, publicKeyFromPrivate } from './storage/encryption.js';
export type { ZGStorageAdapter, ZGStorageConfig } from './storage/log.js';
export type { ZGComputeBroker, ZGComputeConfig } from './compute/broker.js';
export { createZGStorage } from './storage/log.js';
export { createZGCompute } from './compute/broker.js';
export { replayFromRoots, type ReplayResult } from './replay/engine.js';
export * as erc8004 from './erc8004/index.js';
