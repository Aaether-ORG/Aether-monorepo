/**
 * 0G Compute broker wrapper.
 *
 * Captures TEE attestation from inference responses and packages it for the event log.
 * Uses `@0gfoundation/0g-compute-ts-sdk` under the hood.
 */
import type { ethers } from 'ethers';
import { createRequire } from 'node:module';
import type { Message } from '../types.js';
import type { TEEAttestation } from '../events.js';

// 0G Compute SDK ships with chunk-style ESM that breaks under tsx/esbuild.
// Force CJS via createRequire — works reliably in Node 20+.
const require = createRequire(import.meta.url);

export interface ZGComputeBroker {
  chat(args: {
    messages: Message[];
    model?: string;
  }): Promise<{
    content: string;
    raw: any;
    attestation: TEEAttestation;
    requestHashHeader?: string;
  }>;
  listModels(): Promise<string[]>;
  getDefaultProviderAddr(): string;
}

export interface ZGComputeConfig {
  wallet: ethers.Wallet;
  /** Provider address (from `broker.inference.listService()`). Set after Day-0. */
  providerAddress: string;
  /** Default model id. */
  defaultModel?: string;
}

/**
 * Lazy-initializes the broker. The first call funds the ledger if balance is too low.
 */
export async function createZGCompute(config: ZGComputeConfig): Promise<ZGComputeBroker> {
  const { createZGComputeNetworkBroker } = require('@0gfoundation/0g-compute-ts-sdk');
  const broker = await createZGComputeNetworkBroker(config.wallet);

  // Acknowledge provider once (idempotent).
  try {
    await broker.inference.acknowledgeProviderSigner(config.providerAddress);
  } catch (e: any) {
    // If already acknowledged, broker throws — swallow.
    if (!String(e?.message ?? '').includes('already')) {
      console.warn('acknowledgeProviderSigner warning:', e?.message);
    }
  }

  return {
    async chat({ messages, model }) {
      const payload = JSON.stringify({ messages, model: model ?? config.defaultModel });
      const { endpoint, model: serviceModel } = await broker.inference.getServiceMetadata(
        config.providerAddress,
      );
      const headers = await broker.inference.getRequestHeaders(config.providerAddress, payload);

      // 0G provider exposes OpenAI-compatible endpoint at ${endpoint}/chat/completions
      // (where endpoint already includes /v1/proxy from getServiceMetadata).
      const res = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: payload,
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`0G Compute call failed: ${res.status} ${t}`);
      }

      const data = await res.json();

      // Capture all response headers as opaque (parsing format varies per model).
      const rawHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => { rawHeaders[k] = v; });

      const attestation: TEEAttestation = {
        signature: (rawHeaders['tee-signature'] ?? rawHeaders['x-tee-signature'] ?? '0x') as `0x${string}`,
        certFingerprint: (rawHeaders['tls-cert-fingerprint'] as `0x${string}`) ?? undefined,
        modelId: serviceModel,
        providerAddress: config.providerAddress,
        rawHeaders,
      };

      // Fire-and-forget billing settlement (DO NOT await — it's slow and async).
      const requestHashHeader = headers['Request-Hash'] ?? headers['request-hash'];
      Promise.resolve(
        broker.inference.processResponse(config.providerAddress, data, requestHashHeader ?? ''),
      ).catch((e) => console.warn('processResponse warning:', e?.message));

      const content = data.choices?.[0]?.message?.content ?? '';
      return { content, raw: data, attestation, requestHashHeader };
    },

    async listModels() {
      const services = await broker.inference.listService();
      return Array.from(new Set(services.map((s: any) => s.model as string)));
    },

    getDefaultProviderAddr() {
      return config.providerAddress;
    },
  };
}
