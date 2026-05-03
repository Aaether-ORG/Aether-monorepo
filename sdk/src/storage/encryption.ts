/**
 * AES-128-GCM master encryption (keys are 16 bytes to fit ERC-7857 `bytes16` sealedKey).
 * For sealing the master key to a recipient, we use ECIES-style: encrypt with shared secret
 * derived from ECDH(authority, recipientPubKey).
 *
 * Hackathon note: this is a minimum-viable cryptographic shim. Production must use a
 * vetted ECIES library and run sealing inside a TEE.
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'node:crypto';
import { hexlify, getBytes, computeAddress, SigningKey } from 'ethers';
import type { Hex } from '../types.js';

/** Generate a fresh 128-bit master key. */
export function generateMasterKey(): Uint8Array {
  return randomBytes(16);
}

export function encryptMaster(plaintext: Uint8Array, key: Uint8Array): {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  tag: Uint8Array;
} {
  if (key.length !== 16) throw new Error('master key must be 16 bytes (AES-128)');
  const iv = randomBytes(12); // GCM standard
  const cipher = createCipheriv('aes-128-gcm', key, iv);
  const c1 = cipher.update(plaintext);
  const c2 = cipher.final();
  const ciphertext = Buffer.concat([c1, c2]);
  const tag = cipher.getAuthTag();
  return { ciphertext, iv, tag };
}

export function decryptMaster(args: {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  tag: Uint8Array;
  key: Uint8Array;
}): Uint8Array {
  const decipher = createDecipheriv('aes-128-gcm', args.key, args.iv);
  decipher.setAuthTag(args.tag);
  const m1 = decipher.update(args.ciphertext);
  const m2 = decipher.final();
  return Buffer.concat([m1, m2]);
}

/**
 * Seal a 16-byte master key for a recipient.
 *
 * Hackathon implementation: derive a shared secret from ECDH(authorityPriv, recipientPub)
 * using secp256k1, take the first 16 bytes of keccak256 as a key, then XOR-encrypt the
 * 16-byte master key.
 *
 * The result is exactly 16 bytes — fitting ERC-7857's `bytes16 sealedKey`.
 *
 * NOTE: This is structurally compatible with the ERC-7857 spec but is NOT
 * cryptographically robust. Production must use a real ECIES KEM.
 */
export function sealKey(masterKey: Uint8Array, recipientPubKeyHex: Hex, authorityPrivKeyHex: Hex): Hex {
  if (masterKey.length !== 16) throw new Error('master key must be 16 bytes');
  const shared = sharedSecret(authorityPrivKeyHex, recipientPubKeyHex);
  const xorKey = shared.slice(0, 16);
  const sealed = new Uint8Array(16);
  for (let i = 0; i < 16; i++) sealed[i] = masterKey[i]! ^ xorKey[i]!;
  return hexlify(sealed) as Hex;
}

export function openKey(sealedKeyHex: Hex, recipientPrivKeyHex: Hex, authorityPubKeyHex: Hex): Uint8Array {
  const shared = sharedSecret(recipientPrivKeyHex, authorityPubKeyHex);
  const xorKey = shared.slice(0, 16);
  const sealed = getBytes(sealedKeyHex);
  if (sealed.length !== 16) throw new Error('sealedKey must be 16 bytes');
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = sealed[i]! ^ xorKey[i]!;
  return out;
}

function sharedSecret(privKeyHex: Hex, pubKeyHex: Hex): Uint8Array {
  // Use ethers' SigningKey to compute ECDH on secp256k1
  const sk = new SigningKey(privKeyHex);
  const shared = sk.computeSharedSecret(pubKeyHex);
  // Hash to a uniform 32 bytes
  return getBytes(createHash('sha256').update(getBytes(shared)).digest('hex'));
}

export function publicKeyFromPrivate(privKeyHex: Hex): Hex {
  const sk = new SigningKey(privKeyHex);
  return sk.publicKey as Hex;
}
