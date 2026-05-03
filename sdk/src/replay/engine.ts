/**
 * Replay engine — given an iNFT's event log, reconstruct the agent's state
 * deterministically. The replay verifies each event's chained hash so any
 * tampering invalidates downstream events.
 */
import { ethers } from 'ethers';
import { hashEvent, GENESIS_HASH, type AetherEvent } from '../events.js';
import type { Hex } from '../types.js';
import type { ZGStorageAdapter } from '../storage/log.js';

export interface ReplayResult {
  events: AetherEvent[];
  finalHash: Hex;
  inferenceCount: number;
  toolCallCount: number;
  observationCount: number;
}

export async function replayFromRoots(
  storage: ZGStorageAdapter,
  rootHashes: string[],
): Promise<ReplayResult> {
  const events: AetherEvent[] = [];
  let prev: Hex = GENESIS_HASH;
  let inferenceCount = 0, toolCallCount = 0, observationCount = 0;

  for (const root of rootHashes) {
    const event = await storage.readEvent(root);
    if (event.prevHash !== prev) {
      throw new Error(
        `chain break at root ${root}: expected prevHash ${prev} but got ${event.prevHash}`,
      );
    }
    events.push(event);
    prev = hashEvent(event);

    if (event.type === 'inference') inferenceCount++;
    else if (event.type === 'tool_call') toolCallCount++;
    else if (event.type === 'observation') observationCount++;
  }

  return {
    events,
    finalHash: prev,
    inferenceCount,
    toolCallCount,
    observationCount,
  };
}
