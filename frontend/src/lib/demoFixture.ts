/**
 * Fixture: a fake but realistic event sequence for Thornbury's research run.
 * Used for the demo when real 0G calls aren't wired (or for fallback during
 * the live demo if the network hiccups).
 */
import type { AetherEvent, Hex } from './types';

const h = (n: number, c: string = '0'): Hex =>
  ('0x' + c.repeat(2).repeat(n)) as Hex;

const z32: Hex = '0x' + '00'.repeat(32) as Hex;

let prev = z32;
const now = Date.now();
let t = now - 60_000;
const pushTime = () => { t += Math.floor(2000 + Math.random() * 4000); return t; };

function push(e: any): AetherEvent {
  const event = { ...e, prevHash: prev } as AetherEvent;
  // Pseudo hash chain: just rotate by index for demo purposes
  prev = (`0x${(parseInt(prev.slice(-2), 16) + 1).toString(16).padStart(2, '0')}${prev.slice(2, -2)}aa`) as Hex;
  return event;
}

export const DEMO_EVENTS: AetherEvent[] = [
  push({
    type: 'observation',
    ts: pushTime(),
    source: 'https://arxiv.org/abs/2601.00001',
    contentHash: h(32, '11'),
  }),
  push({
    type: 'observation',
    ts: pushTime(),
    source: 'https://arxiv.org/abs/2601.00002',
    contentHash: h(32, '12'),
  }),
  push({
    type: 'tool_call',
    ts: pushTime(),
    tool: 'arxiv_search',
    argsHash: h(32, '21'),
    resultHash: h(32, '22'),
  }),
  push({
    type: 'inference',
    ts: pushTime(),
    model: 'glm-5-fp8',
    promptHash: h(32, '31'),
    outputHash: h(32, '32'),
    attestation: {
      signature: ('0x' + 'ab'.repeat(65)) as Hex,
      modelId: 'glm-5-fp8',
      providerAddress: '0x9D40C4dF1A7E4Aa0a5dd4F9bb1234567890aBcDe',
    },
  }),
  push({
    type: 'inference',
    ts: pushTime(),
    model: 'glm-5-fp8',
    promptHash: h(32, '33'),
    outputHash: h(32, '34'),
    attestation: {
      signature: ('0x' + 'ac'.repeat(65)) as Hex,
      modelId: 'glm-5-fp8',
      providerAddress: '0x9D40C4dF1A7E4Aa0a5dd4F9bb1234567890aBcDe',
    },
  }),
  push({
    type: 'inference',
    ts: pushTime(),
    model: 'qwen3-vl-30b-a3b-instruct',
    promptHash: h(32, '35'),
    outputHash: h(32, '36'),
    attestation: {
      signature: ('0x' + 'ad'.repeat(65)) as Hex,
      modelId: 'qwen3-vl-30b-a3b-instruct',
      providerAddress: '0x4Ab7C29bE1234567890Ef0123456789abCDeF012',
    },
  }),
  push({
    type: 'state_mutation',
    ts: pushTime(),
    key: 'report:cell-free-protein-synthesis',
    prevValueHash: z32,
    newValueHash: h(32, '41'),
  }),
];
