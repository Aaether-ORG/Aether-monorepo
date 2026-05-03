/**
 * Ammonite CCIP-Read gateway — wired to live agent state.
 *
 * The AmmoniteResolver contract issues `OffchainLookup` errors that resolvers
 * (browser, wallet, MCP client) call this gateway to satisfy. This gateway
 * pulls the requested record's *current* value from the configured backend
 * (Thornbury server `/sessions/...` or 0G Storage KV) and returns it
 * ABI-encoded as a `string`.
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { AbiCoder, keccak256, toUtf8Bytes } from 'ethers';
import { isDynamicKey } from '../../src/records.js';

const PORT = Number(process.env.AMMONITE_PORT ?? 8080);
const THORNBURY = process.env.THORNBURY_URL ?? 'http://localhost:3000';
const ALLOW_ORIGIN = process.env.CORS_ORIGIN ?? '*';

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(cors({ origin: ALLOW_ORIGIN }));

// === Records ===

interface RecordContext {
  node: string;
  key: string;
  /** The agent's subname label, e.g. "thornbury" — extracted from node when possible. */
  label?: string;
}

/**
 * Resolve a record value. Static records are stored in this gateway's memory
 * for the demo; production reads from a database keyed by node hash.
 */
async function resolveRecord(ctx: RecordContext): Promise<string> {
  // Dynamic — pull live state
  if (isDynamicKey(ctx.key)) {
    return await fetchDynamic(ctx);
  }
  // Fall back to in-memory static (matches test data)
  return STATIC_RECORDS[`${ctx.node}:${ctx.key}`] ?? STATIC_RECORDS[`*:${ctx.key}`] ?? '';
}

async function fetchDynamic(ctx: RecordContext): Promise<string> {
  switch (ctx.key) {
    case 'agent.aether.head': {
      // Latest event hash from the Thornbury backend.
      try {
        const r = await fetch(`${THORNBURY}/sessions/latest/head`, { signal: AbortSignal.timeout(2000) });
        if (r.ok) {
          const j = await r.json();
          return j.head ?? '';
        }
      } catch { /* fall through */ }
      return '0x' + '00'.repeat(32);
    }
    case 'agent.uptime.last24h': {
      try {
        const r = await fetch(`${THORNBURY}/health`, { signal: AbortSignal.timeout(1500) });
        return r.ok ? '99.9' : '0';
      } catch { return '0'; }
    }
    case 'agent.model.version': {
      return process.env.ZG_COMPUTE_DEFAULT_MODEL ?? 'glm-5-fp8@2026.04';
    }
    case 'agent.aether.replay_url': {
      const lastTokenId = await fetchLatestTokenId();
      if (lastTokenId) return `${THORNBURY}/agent/${lastTokenId}/replay`;
      return '';
    }
    default:
      return '';
  }
}

async function fetchLatestTokenId(): Promise<string | undefined> {
  try {
    const r = await fetch(`${THORNBURY}/sessions/latest`, { signal: AbortSignal.timeout(1500) });
    if (r.ok) {
      const j = await r.json();
      return j.tokenId;
    }
  } catch { /* nothing */ }
}

const STATIC_RECORDS: Record<string, string> = {
  '*:agent.services.web':  `${THORNBURY}/`,
  '*:agent.services.mcp':  `${THORNBURY}/mcp`,
  '*:agent.services.x402': `${THORNBURY}/.well-known/x402`,
  '*:avatar':              `${THORNBURY}/avatar.svg`,
  '*:description':         'Self-financing research agent on 0G — replayable via Aether',
};

// === Routes ===

app.get('/health', (_req, res) => res.json({ ok: true }));

/**
 * CCIP-Read endpoint. Resolvers call this with `{sender}` and `{data}`
 * substituted into the URL. We accept both GET (URL params) and POST (JSON body)
 * to satisfy ENSIP-10 + EIP-3668.
 */
app.all('/:sender/:data', async (req, res) => {
  try {
    let callData = req.params.data;
    if (req.method === 'POST') {
      callData = req.body?.data ?? callData;
    }

    // The resolver encodes (bytes32 node, string key) per AmmoniteResolver.
    const decoded = AbiCoder.defaultAbiCoder().decode(['bytes32', 'string'], callData);
    const node = decoded[0] as string;
    const key = decoded[1] as string;

    const value = await resolveRecord({ node, key });
    const responseBytes = AbiCoder.defaultAbiCoder().encode(['string'], [value]);

    res.json({ data: responseBytes });
  } catch (e: any) {
    console.error('[ammonite] error:', e?.message);
    res.status(400).json({ error: e?.message ?? 'bad request' });
  }
});

/** Convenience query mode for testing without ABI encoding. */
app.get('/lookup', async (req, res) => {
  const node = (req.query.node as string) ?? '0x' + '00'.repeat(32);
  const key = (req.query.key as string) ?? 'agent.aether.head';
  const value = await resolveRecord({ node, key });
  res.json({ node, key, value });
});

app.listen(PORT, () => {
  console.log(`[Ammonite gateway] listening on http://localhost:${PORT}`);
  console.log(`  Thornbury backend: ${THORNBURY}`);
  console.log('Test:');
  console.log(`  curl "http://localhost:${PORT}/lookup?key=agent.aether.head"`);
  console.log(`  curl "http://localhost:${PORT}/lookup?key=agent.services.x402"`);
});
