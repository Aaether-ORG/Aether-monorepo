import { describe, it, expect } from 'vitest';
import { hashEvent, GENESIS_HASH, type AetherEvent, type ToolCallEvent } from '../src/events.js';

/**
 * Replay engine test using an in-memory storage stub.
 * The real replay engine talks to 0G Storage; here we mock it.
 */

interface FakeStorage {
  byRoot: Map<string, AetherEvent>;
  rootForEvent: Map<string, string>;
  rootHashes: string[];
}

function makeStorage(events: AetherEvent[]): FakeStorage {
  const s: FakeStorage = {
    byRoot: new Map(),
    rootForEvent: new Map(),
    rootHashes: [],
  };
  for (const e of events) {
    const eventHash = hashEvent(e);
    const root = `0G_ROOT_${eventHash.slice(2, 12)}`;
    s.byRoot.set(root, e);
    s.rootForEvent.set(eventHash, root);
    s.rootHashes.push(root);
  }
  return s;
}

async function replay(s: FakeStorage): Promise<{ events: AetherEvent[]; finalHash: string; valid: boolean }> {
  const out: AetherEvent[] = [];
  let prev: string = GENESIS_HASH;
  for (const root of s.rootHashes) {
    const e = s.byRoot.get(root);
    if (!e) return { events: out, finalHash: prev, valid: false };
    if (e.prevHash !== prev) {
      return { events: out, finalHash: prev, valid: false };
    }
    out.push(e);
    prev = hashEvent(e);
  }
  return { events: out, finalHash: prev, valid: true };
}

describe('replay engine', () => {
  it('reconstructs a chain end-to-end', async () => {
    const events: AetherEvent[] = [];
    let prev = GENESIS_HASH;
    for (let i = 0; i < 4; i++) {
      const e: ToolCallEvent = {
        type: 'tool_call', ts: i, prevHash: prev,
        tool: `t${i}`,
        argsHash: '0x' + '00'.repeat(32) as `0x${string}`,
        resultHash: '0x' + '00'.repeat(32) as `0x${string}`,
      };
      events.push(e);
      prev = hashEvent(e);
    }

    const storage = makeStorage(events);
    const result = await replay(storage);
    expect(result.valid).toBe(true);
    expect(result.events.length).toBe(4);
  });

  it('detects chain breakage', async () => {
    const events: AetherEvent[] = [];
    let prev = GENESIS_HASH;
    for (let i = 0; i < 3; i++) {
      const e: ToolCallEvent = {
        type: 'tool_call', ts: i, prevHash: prev,
        tool: `t${i}`,
        argsHash: '0x' + '00'.repeat(32) as `0x${string}`,
        resultHash: '0x' + '00'.repeat(32) as `0x${string}`,
      };
      events.push(e);
      prev = hashEvent(e);
    }

    // Tamper: change ts of event 1 (its hash will change, so event 2's prevHash is stale)
    events[1] = { ...events[1]!, ts: 999 } as ToolCallEvent;
    const storage = makeStorage(events);
    const result = await replay(storage);
    expect(result.valid).toBe(false);
  });
});
