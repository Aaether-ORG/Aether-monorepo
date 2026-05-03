import { describe, it, expect } from 'vitest';
import { canonicalJSON, hashEvent, GENESIS_HASH, type InferenceEvent } from '../src/events.js';

describe('events', () => {
  it('canonicalJSON sorts keys', () => {
    expect(canonicalJSON({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it('canonicalJSON is recursive', () => {
    expect(canonicalJSON({ x: { c: 1, b: 2 }, a: [3, { y: 1, x: 2 }] }))
      .toBe('{"a":[3,{"x":2,"y":1}],"x":{"b":2,"c":1}}');
  });

  it('hashEvent is deterministic', () => {
    const event: InferenceEvent = {
      type: 'inference',
      ts: 1700000000000,
      prevHash: GENESIS_HASH,
      model: 'glm-5-fp8',
      promptHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      outputHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
      attestation: {
        signature: '0x',
        modelId: 'glm-5-fp8',
        providerAddress: '0x0000000000000000000000000000000000000000',
      },
    };
    const a = hashEvent(event);
    const b = hashEvent(event);
    expect(a).toBe(b);
  });

  it('hashEvent depends on prevHash', () => {
    const base: InferenceEvent = {
      type: 'inference',
      ts: 1700000000000,
      prevHash: GENESIS_HASH,
      model: 'glm-5-fp8',
      promptHash: '0x' + '11'.repeat(32),
      outputHash: '0x' + '22'.repeat(32),
      attestation: { signature: '0x', modelId: 'glm-5-fp8', providerAddress: '0x0' + '0'.repeat(39) },
    };
    const a = hashEvent(base);
    const b = hashEvent({ ...base, prevHash: ('0x' + '33'.repeat(32)) as any });
    expect(a).not.toBe(b);
  });
});
