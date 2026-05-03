/**
 * Integration tests — exercise the full event chain pipeline without external network.
 *
 * What we test (without real 0G/Compute/network):
 *   1. Event hashing is deterministic and chain-linked
 *   2. canonicalJSON is stable across key orders
 *   3. AES-128-GCM encrypt/decrypt roundtrip
 *   4. ECIES-style key sealing/opening roundtrip
 *   5. Replay engine reconstructs event chain integrity
 *
 * What we DON'T test here (those need testnet, see scripts/day0):
 *   - Real 0G Compute calls
 *   - Real 0G Storage uploads
 *   - On-chain mint/transfer
 */
import { describe, it, expect } from 'vitest';
import { Wallet, ZeroHash } from 'ethers';
import {
  hashEvent, canonicalJSON, GENESIS_HASH,
  type AetherEvent, type InferenceEvent, type ToolCallEvent,
} from '../src/events.js';
import {
  encryptMaster, decryptMaster, sealKey, openKey, generateMasterKey,
  publicKeyFromPrivate,
} from '../src/storage/encryption.js';

describe('Integration — full pipeline (no network)', () => {

  describe('event hashing', () => {
    it('produces stable hashes regardless of key order', () => {
      const e1: InferenceEvent = {
        type: 'inference',
        ts: 1700000000000,
        prevHash: GENESIS_HASH,
        model: 'glm-5-fp8',
        promptHash: '0x' + '11'.repeat(32) as `0x${string}`,
        outputHash: '0x' + '22'.repeat(32) as `0x${string}`,
        attestation: {
          signature: '0x' + 'aa'.repeat(65) as `0x${string}`,
          modelId: 'glm-5-fp8',
          providerAddress: '0x9D40C4dF1A7E4Aa0a5dd4F9bb1234567890aBcDe',
        },
      };
      const e2: InferenceEvent = {
        attestation: e1.attestation,
        outputHash: e1.outputHash,
        promptHash: e1.promptHash,
        model: e1.model,
        prevHash: e1.prevHash,
        ts: e1.ts,
        type: 'inference',
      };
      expect(hashEvent(e1)).toBe(hashEvent(e2));
    });

    it('breaks the chain when prevHash is tampered', () => {
      const a: ToolCallEvent = {
        type: 'tool_call',
        ts: 1, prevHash: GENESIS_HASH,
        tool: 't', argsHash: '0x' + '00'.repeat(32) as `0x${string}`,
        resultHash: '0x' + '00'.repeat(32) as `0x${string}`,
      };
      const tampered: ToolCallEvent = { ...a, prevHash: '0x' + '01'.repeat(32) as `0x${string}` };
      expect(hashEvent(a)).not.toBe(hashEvent(tampered));
    });

    it('chain-links events via prevHash', () => {
      const a: ToolCallEvent = {
        type: 'tool_call', ts: 1, prevHash: GENESIS_HASH,
        tool: 'x', argsHash: '0x' + '00'.repeat(32) as `0x${string}`,
        resultHash: '0x' + '00'.repeat(32) as `0x${string}`,
      };
      const aHash = hashEvent(a);
      const b: ToolCallEvent = {
        type: 'tool_call', ts: 2, prevHash: aHash,
        tool: 'y', argsHash: '0x' + '00'.repeat(32) as `0x${string}`,
        resultHash: '0x' + '00'.repeat(32) as `0x${string}`,
      };
      expect(b.prevHash).toBe(aHash);
      const bHash = hashEvent(b);
      expect(bHash).not.toBe(aHash);
    });
  });

  describe('canonical JSON', () => {
    it('stable across key order', () => {
      expect(canonicalJSON({ b: 1, a: 2 })).toBe(canonicalJSON({ a: 2, b: 1 }));
    });
    it('handles arrays', () => {
      expect(canonicalJSON([1, { y: 1, x: 2 }])).toBe('[1,{"x":2,"y":1}]');
    });
    it('handles null', () => {
      expect(canonicalJSON(null)).toBe('null');
    });
    it('handles nested', () => {
      const a = { x: { c: 1, b: 2 }, a: [3, { y: 1, x: 2 }] };
      const b = { a: [3, { x: 2, y: 1 }], x: { b: 2, c: 1 } };
      expect(canonicalJSON(a)).toBe(canonicalJSON(b));
    });
  });

  describe('master-key encryption', () => {
    it('AES-128-GCM roundtrips', () => {
      const key = generateMasterKey();
      const plaintext = new TextEncoder().encode('hello aether');
      const { ciphertext, iv, tag } = encryptMaster(plaintext, key);
      const recovered = decryptMaster({ ciphertext, iv, tag, key });
      expect(new TextDecoder().decode(recovered)).toBe('hello aether');
    });

    it('rejects key length != 16', () => {
      expect(() => encryptMaster(new Uint8Array(0), new Uint8Array(32))).toThrow();
    });
  });

  describe('ECIES-style sealed key', () => {
    it('roundtrips a 16-byte master key', () => {
      const aliceWallet = Wallet.createRandom();
      const bobWallet   = Wallet.createRandom();
      const masterKey = generateMasterKey();

      // Alice (authority) seals master key for Bob (recipient)
      const sealed = sealKey(
        masterKey,
        publicKeyFromPrivate(bobWallet.privateKey as `0x${string}`),
        aliceWallet.privateKey as `0x${string}`,
      );

      // sealedKey must be 16 bytes (ERC-7857 bytes16)
      expect(sealed.length).toBe(2 + 16 * 2); // 0x + 32 hex chars

      // Bob opens with his private key and Alice's public key
      const recovered = openKey(
        sealed,
        bobWallet.privateKey as `0x${string}`,
        publicKeyFromPrivate(aliceWallet.privateKey as `0x${string}`),
      );

      expect(Buffer.from(recovered).toString('hex')).toBe(Buffer.from(masterKey).toString('hex'));
    });

    it('a third party cannot open the sealed key', () => {
      const aliceWallet = Wallet.createRandom();
      const bobWallet = Wallet.createRandom();
      const eveWallet = Wallet.createRandom();
      const masterKey = generateMasterKey();

      const sealed = sealKey(
        masterKey,
        publicKeyFromPrivate(bobWallet.privateKey as `0x${string}`),
        aliceWallet.privateKey as `0x${string}`,
      );

      // Eve tries with her own private key
      const garbage = openKey(
        sealed,
        eveWallet.privateKey as `0x${string}`,
        publicKeyFromPrivate(aliceWallet.privateKey as `0x${string}`),
      );

      expect(Buffer.from(garbage).toString('hex')).not.toBe(Buffer.from(masterKey).toString('hex'));
    });
  });

  describe('end-to-end agent log scenario', () => {
    it('reconstructs a 5-event chain deterministically', () => {
      const events: AetherEvent[] = [];
      let prev = GENESIS_HASH;

      // Emit 5 events
      for (let i = 0; i < 5; i++) {
        const e: ToolCallEvent = {
          type: 'tool_call',
          ts: 1700000000000 + i * 1000,
          prevHash: prev,
          tool: `tool_${i}`,
          argsHash: ('0x' + i.toString(16).padStart(2, '0').repeat(32)) as `0x${string}`,
          resultHash: ('0x' + ((i + 1) % 256).toString(16).padStart(2, '0').repeat(32)) as `0x${string}`,
        };
        events.push(e);
        prev = hashEvent(e);
      }

      // Verify each prevHash matches the previous event's hash
      for (let i = 1; i < events.length; i++) {
        expect(events[i]!.prevHash).toBe(hashEvent(events[i - 1]!));
      }

      // Tamper with one event in the middle and re-verify — chain should break
      const tampered = [...events];
      tampered[2] = { ...tampered[2]!, ts: 9999999999 } as ToolCallEvent;
      const newHash2 = hashEvent(tampered[2]!);
      expect(newHash2).not.toBe(hashEvent(events[2]!));
      // The next event's stored prevHash still points at the OLD hash, so it no longer matches.
      expect(tampered[3]!.prevHash).not.toBe(newHash2);
    });
  });
});
