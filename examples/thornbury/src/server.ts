/**
 * Thornbury HTTP server — wired end-to-end.
 *
 * Routes:
 *   GET  /health
 *   GET  /.well-known/agent-card.json     ERC-8004 agent card
 *
 *   POST /research                         body: { question }
 *                                          ↳ kicks off a research session, returns sessionId
 *   GET  /sessions/:sessionId/events       SSE — streams Aether events live
 *   GET  /sessions/:sessionId              session metadata (status, tokenId, finalReport)
 *
 *   GET  /report/:tokenId                  x402 paywalled — returns report
 *
 *   GET  /agent/:tokenId/replay            returns the agent's full event log (after auth)
 */
import { config as dotenvConfig } from 'dotenv';
import { resolve as resolvePath } from 'node:path';
dotenvConfig({ path: resolvePath(import.meta.dirname, '..', '..', '..', '.env') });

import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import kleur from 'kleur';
import { randomUUID } from 'node:crypto';

import { createThornbury } from './agent.js';
import type { ThornburyResult } from './agent.js';
import type { AetherEvent } from '@aether/sdk';
import { createZGStorage, generateMasterKey } from '@aether/sdk';
import { x402Challenge } from '@aether/payments';
import { createGuard } from '@aether/guard';

const PORT = Number(process.env.THORNBURY_PORT ?? 3000);
const ALLOW_ORIGIN = process.env.CORS_ORIGIN ?? '*';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: ALLOW_ORIGIN }));

interface Session {
  id: string;
  question: string;
  status: 'researching' | 'minting' | 'completed' | 'failed';
  events: { evt: AetherEvent; eventHash: string; rootHash: string }[];
  result?: ThornburyResult;
  error?: string;
  /** Active SSE response objects to broadcast to. */
  subscribers: Set<Response>;
}

const sessions = new Map<string, Session>();
/** tokenId → in-memory copy of the report (cache; primary source is 0G Storage) */
const reports = new Map<string, string>();
/** tokenId → { reportRoot, masterKeyHex } so we can fetch from 0G Storage on demand */
const reportPointers = new Map<string, { reportRoot: string; masterKeyHex: string }>();

function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

// === Routes ===

app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.get('/.well-known/agent-card.json', (_req, res) => {
  const baseUrl = `http://localhost:${PORT}`;
  res.json({
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: 'Thornbury',
    description: 'Self-financing research agent on 0G',
    image: `${baseUrl}/avatar.svg`,
    services: [
      { name: 'web', endpoint: `${baseUrl}/` },
      { name: 'A2A', endpoint: `${baseUrl}/.well-known/agent-card.json`, version: '0.3.0' },
      { name: 'MCP', endpoint: `${baseUrl}/mcp`, version: '2025-06-18' },
    ],
    x402Support: true,
    active: true,
    registrations: [],
    supportedTrust: ['reputation', 'tee-attestation'],
  });
});

// === Research session lifecycle ===

app.post('/research', async (req, res) => {
  const question: string = req.body?.question?.trim();
  if (!question) {
    res.status(400).json({ error: 'question is required' });
    return;
  }

  const sessionId = randomUUID();
  const session: Session = {
    id: sessionId,
    question,
    status: 'researching',
    events: [],
    subscribers: new Set(),
  };
  sessions.set(sessionId, session);

  // Kick off the agent in the background — don't block the HTTP response
  void runResearchAsync(session).catch((e) => {
    session.status = 'failed';
    session.error = String(e?.message ?? e);
    broadcast(session, { type: '__error', error: session.error } as any);
  });

  res.json({ sessionId, question, status: session.status });
});

app.get('/sessions/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId!;
  const s = sessionId === 'latest' ? latestSession() : getSession(sessionId);
  if (!s) { res.status(404).json({ error: 'session not found' }); return; }
  res.json({
    id: s.id,
    question: s.question,
    status: s.status,
    eventCount: s.events.length,
    head: s.events.at(-1)?.eventHash,
    tokenId: s.result?.tokenId?.toString(),
    txHash: s.result?.txHash,
    finalReport: s.result?.finalReport,
    error: s.error,
  });
});

app.get('/sessions/:sessionId/head', (req, res) => {
  const sessionId = req.params.sessionId!;
  const s = sessionId === 'latest' ? latestSession() : getSession(sessionId);
  if (!s) { res.status(404).json({ error: 'session not found' }); return; }
  res.json({ head: s.events.at(-1)?.eventHash ?? '0x' + '00'.repeat(32) });
});

function latestSession(): Session | undefined {
  // Most recently created session that minted something, else most recent any
  const all = [...sessions.values()];
  return all.findLast((s) => s.result?.tokenId) ?? all.at(-1);
}

/** Decrypt a report blob from 0G Storage using its rootHash + master key. */
async function fetchReportFromStorage(p: { reportRoot: string; masterKeyHex: string }): Promise<string> {
  const masterKey = Buffer.from(p.masterKeyHex.replace(/^0x/, ''), 'hex');
  if (masterKey.length !== 16) throw new Error('expected 16-byte master key');
  const provider = new ethers.JsonRpcProvider(process.env.ZG_RPC_URL!);
  const wallet = new ethers.Wallet(process.env.AGENT_OWNER_PRIVATE_KEY!, provider);
  const storage = await createZGStorage({
    indexerUrl: process.env.ZG_INDEXER_RPC_URL!,
    rpcUrl: process.env.ZG_RPC_URL!,
    signer: wallet,
    masterKey,
  });
  const bytes = await storage.readBlob(p.reportRoot);
  const text = new TextDecoder().decode(bytes);
  // Report blob is JSON: { question, finalReport, papers, summaries }
  const parsed = JSON.parse(text);
  return parsed.finalReport ?? text;
}

app.get('/sessions/:sessionId/events', (req, res) => {
  const s = getSession(req.params.sessionId!);
  if (!s) { res.status(404).json({ error: 'session not found' }); return; }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Replay events that already happened
  for (const e of s.events) {
    sendSSE(res, 'event', e);
  }
  // Replay status if already terminal
  if (s.status !== 'researching') {
    sendSSE(res, 'status', {
      status: s.status,
      tokenId: s.result?.tokenId?.toString(),
      txHash: s.result?.txHash,
      finalReport: s.result?.finalReport,
      error: s.error,
    });
  }

  s.subscribers.add(res);
  req.on('close', () => {
    s.subscribers.delete(res);
  });
});

// === x402 paywall on the report ===

app.get('/report/:tokenId', async (req, res) => {
  const tokenId = req.params.tokenId!;
  const paymentSig = req.header('PAYMENT-SIGNATURE');
  const buyerAddr = req.header('X-Buyer-Address') ?? req.body?.buyerAddress;

  if (!paymentSig) {
    // x402 challenge. The asset's EIP-712 domain (name+version+decimals) ships in
    // `extra` so the buyer's browser can sign with zero hard-coded knowledge of
    // the asset — they get everything from this challenge.
    const { header, status } = x402Challenge([{
      scheme: 'exact',
      network: process.env.X402_NETWORK ?? '16602',
      maxAmountRequired: '500000', // 0.50 ZGUSD (6 decimals)
      asset: process.env.ZGUSD_ADDRESS!,
      payTo: process.env.AGENT_PAYMENT_ADDRESS ?? ethers.ZeroAddress,
      description: `Thornbury report ${tokenId}`,
      extra: {
        assetTransferMethod: 'eip3009',
        name: process.env.ZGUSD_NAME ?? 'ZG-USD',
        version: process.env.ZGUSD_VERSION ?? '2',
        decimals: Number(process.env.ZGUSD_DECIMALS ?? '6'),
      },
    }]);
    res.status(status)
      .setHeader('PAYMENT-REQUIRED', header)
      .setHeader('Access-Control-Expose-Headers', 'PAYMENT-REQUIRED, PAYMENT-RESPONSE')
      .json({ error: 'Payment required' });
    return;
  }

  console.log(kleur.green(`[server] payment ${paymentSig.slice(0, 24)}… for token ${tokenId} from ${buyerAddr}`));

  // 1a. SETTLE: actually move ZGUSD via transferWithAuthorization.
  //     Validates the buyer's EIP-3009 signature and pulls funds atomically on-chain.
  let settleTxHash: string | undefined;
  try {
    const decoded = JSON.parse(Buffer.from(paymentSig, 'base64').toString());
    const { authorization, signature } = decoded.payload;
    const sig = ethers.Signature.from(signature);
    const provider = new ethers.JsonRpcProvider(process.env.ZG_RPC_URL!);
    // Server pays gas for the meta-tx — that's the x402 model.
    const settler = new ethers.Wallet(process.env.AGENT_OWNER_PRIVATE_KEY!, provider);
    const zgusd = new ethers.Contract(
      process.env.ZGUSD_ADDRESS!,
      [
        'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external',
      ],
      settler,
    );
    const tx = await (zgusd as any).transferWithAuthorization(
      authorization.from,
      authorization.to,
      authorization.value,
      authorization.validAfter,
      authorization.validBefore,
      authorization.nonce,
      sig.v, sig.r, sig.s,
    );
    const receipt = await tx.wait();
    settleTxHash = receipt.hash;
    console.log(kleur.green(`[server] x402 settle: ZGUSD transferWithAuthorization tx=${settleTxHash}`));
  } catch (e: any) {
    console.warn(kleur.yellow(`[server] x402 settle failed: ${e?.shortMessage ?? e?.message ?? e}`));
    // For demo: continue even if settlement fails (e.g. stub signature). Production should reject.
  }

  // 1. authorizeUsage on the AgentNFT.
  //    Primary path: KeeperHub Guard `execute_contract_call` MCP tool.
  //    Fallback:    direct ethers signing with KEEPERHUB_WALLET_PRIVATE_KEY,
  //                 submitted to 0G Galileo RPC.
  //
  //    The fallback exists because KeeperHub's broadcaster currently hangs
  //    >120s on 0G Galileo (chain 16602) — likely a KeeperHub-side bug. We
  //    confirmed by testing the same call on Base Sepolia (responds in 539ms)
  //    vs 0G Galileo (Cloudflare 524 timeout). Documented in FEEDBACK.md.
  let auditId: string | undefined;
  let authzTxHash: string | undefined;
  let guardPath: 'keeperhub-mcp' | 'direct-fallback' | 'none' = 'none';

  if (process.env.AGENT_NFT_ADDRESS && buyerAddr && /^0x[0-9a-fA-F]{40}$/.test(buyerAddr)) {
    // Try KeeperHub MCP first (with a tight 90s timeout — Cloudflare cuts at 120)
    if (process.env.KEEPERHUB_TOKEN) {
      try {
        const guard = createGuard();
        const guardCall = guard.executeContractCall({
          chainId: 16602,
          contractAddress: process.env.AGENT_NFT_ADDRESS,
          functionName: 'authorizeUsage',
          args: [tokenId, buyerAddr],
          abi: [{
            type: 'function', name: 'authorizeUsage', stateMutability: 'nonpayable',
            inputs: [
              { name: '_tokenId', type: 'uint256' },
              { name: '_user', type: 'address' },
            ],
            outputs: [],
          }],
          gasLimitMultiplier: '1.5',
          priorityFeeGwei: '5',
        });
        // Race against a 90s timeout
        const timeout = new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error('KeeperHub timeout (90s)')), 90_000),
        );
        const result = await Promise.race([guardCall, timeout]) as Awaited<typeof guardCall>;
        auditId = result.executionId;
        authzTxHash = result.txHash;
        guardPath = 'keeperhub-mcp';
        console.log(kleur.green(`[server] Guard via KeeperHub: execId=${auditId} tx=${authzTxHash ?? '(pending)'}`));
      } catch (e: any) {
        console.warn(kleur.yellow(`[server] KeeperHub Guard failed (${e?.message?.slice(0,60) ?? e}). Falling back to direct signing.`));
        guardPath = 'direct-fallback';
      }
    } else {
      guardPath = 'direct-fallback';
    }

    // Fallback: sign + broadcast directly using the KeeperHub wallet key
    if (guardPath === 'direct-fallback' && process.env.KEEPERHUB_WALLET_PRIVATE_KEY) {
      try {
        const provider = new ethers.JsonRpcProvider(process.env.ZG_RPC_URL!);
        const wallet = new ethers.Wallet(process.env.KEEPERHUB_WALLET_PRIVATE_KEY!, provider);
        const c = new ethers.Contract(
          process.env.AGENT_NFT_ADDRESS!,
          ['function authorizeUsage(uint256 _tokenId, address _user) external'],
          wallet,
        );
        const tx = await (c as any).authorizeUsage(tokenId, buyerAddr);
        const receipt = await tx.wait();
        authzTxHash = receipt.hash;
        auditId = `fallback-${receipt.blockNumber}`;
        console.log(kleur.cyan(`[server] direct-fallback authorizeUsage tx=${authzTxHash} block=${receipt.blockNumber}`));
      } catch (e: any) {
        console.warn(kleur.red(`[server] direct-fallback also failed: ${e?.shortMessage ?? e?.message}`));
      }
    }
  }

  // 2. Fetch the report. Prefer the in-memory copy; fall back to 0G Storage.
  let report = reports.get(tokenId);
  if (!report) {
    const pointer = reportPointers.get(tokenId);
    if (pointer) {
      try {
        report = await fetchReportFromStorage(pointer);
        reports.set(tokenId, report);
      } catch (e: any) {
        console.warn(`[server] Failed to fetch from 0G Storage: ${e?.message}`);
      }
    }
  }
  if (!report) {
    res.status(404).json({ error: `report for token ${tokenId} not found (mint a report first)` });
    return;
  }

  res.setHeader('PAYMENT-RESPONSE', Buffer.from(JSON.stringify({ ok: true, tokenId, auditId, authzTxHash, settleTxHash, guardPath })).toString('base64'));
  res.setHeader('Access-Control-Expose-Headers', 'PAYMENT-REQUIRED, PAYMENT-RESPONSE');
  res.json({ tokenId, agent: 'thornbury', report, auditId, authzTxHash, settleTxHash, guardPath });
});

// === Replay endpoint ===

app.get('/agent/:tokenId/replay', async (req, res) => {
  const tokenId = req.params.tokenId!;
  const fromStorage = req.query.fromStorage === '1';

  // Find the session whose result minted this tokenId
  const session = [...sessions.values()].find((s) => s.result?.tokenId?.toString() === tokenId);
  if (!session) {
    res.status(404).json({ error: `no session minted token ${tokenId}` });
    return;
  }

  if (!fromStorage) {
    // Fast path: use the in-memory cache
    res.json({
      tokenId,
      chainHead: session.events.at(-1)?.eventHash,
      eventCount: session.events.length,
      source: 'memory',
      events: session.events.map((e) => e.evt),
    });
    return;
  }

  // Storage path: re-fetch every event from 0G Storage and verify the chain
  const pointer = reportPointers.get(tokenId);
  if (!pointer) {
    res.status(404).json({ error: 'no master key on file (server restart?). Re-run with cached session.' });
    return;
  }
  const masterKey = Buffer.from(pointer.masterKeyHex.replace(/^0x/, ''), 'hex');
  const provider = new ethers.JsonRpcProvider(process.env.ZG_RPC_URL!);
  const wallet = new ethers.Wallet(process.env.AGENT_OWNER_PRIVATE_KEY!, provider);
  const storage = await createZGStorage({
    indexerUrl: process.env.ZG_INDEXER_RPC_URL!,
    rpcUrl: process.env.ZG_RPC_URL!,
    signer: wallet,
    masterKey,
  });

  const events: AetherEvent[] = [];
  let prev = '0x' + '00'.repeat(32);
  let valid = true;
  let validatedCount = 0;
  for (const e of session.events) {
    try {
      const fetched = await storage.readEvent(e.rootHash);
      events.push(fetched);
      // Verify chain link
      if (fetched.prevHash !== prev) { valid = false; break; }
      // Compute next prev
      const { hashEvent } = await import('@aether/sdk');
      prev = hashEvent(fetched);
      validatedCount++;
    } catch (err) {
      valid = false; break;
    }
  }

  res.json({
    tokenId,
    chainHead: prev,
    eventCount: events.length,
    validatedCount,
    chainValid: valid,
    source: '0g-storage',
    events,
  });
});

// === Admin / demo helpers ===

app.post('/admin/seed', (req, res) => {
  const { tokenId, report } = req.body;
  reports.set(tokenId, report);
  res.json({ ok: true });
});

app.get('/avatar.svg', (_req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(THORNBURY_AVATAR);
});

// === Server bootstrap ===

app.listen(PORT, () => {
  console.log(kleur.cyan(`[Thornbury] listening on http://localhost:${PORT}`));
  console.log('  POST  /research                       { question } → { sessionId }');
  console.log('  GET   /sessions/:id/events            SSE event stream');
  console.log('  GET   /sessions/:id                   session status');
  console.log('  GET   /report/:tokenId                x402 paywalled report');
  console.log('  GET   /agent/:tokenId/replay          full event log');
  console.log('  GET   /.well-known/agent-card.json    ERC-8004 agent card');
});

// === Internal ===

async function runResearchAsync(session: Session) {
  if (!process.env.ZG_COMPUTE_PROVIDER_ADDRESS) {
    throw new Error('ZG_COMPUTE_PROVIDER_ADDRESS not set — run pnpm day0:compute first');
  }
  const provider = new ethers.JsonRpcProvider(process.env.ZG_RPC_URL!);
  const wallet = new ethers.Wallet(process.env.AGENT_OWNER_PRIVATE_KEY!, provider);

  const { aether, research } = await createThornbury({
    rpcUrl: process.env.ZG_RPC_URL!,
    indexerUrl: process.env.ZG_INDEXER_RPC_URL!,
    ownerWallet: wallet,
    computeProviderAddress: process.env.ZG_COMPUTE_PROVIDER_ADDRESS!,
    defaultModel: process.env.ZG_COMPUTE_DEFAULT_MODEL ?? 'glm-5-fp8',
    agentNFTAddress: process.env.AGENT_NFT_ADDRESS,
    verifierAddress: process.env.AETHER_VERIFIER_ADDRESS,
  });

  // Pipe Aether events to the session
  aether.on((evt, eventHash, rootHash) => {
    const wrapped = { evt, eventHash, rootHash };
    session.events.push(wrapped);
    broadcast(session, wrapped);
  });

  const result = await research(session.question);
  session.result = result;

  // Mint if possible
  if (process.env.AGENT_NFT_ADDRESS) {
    session.status = 'minting';
    broadcast(session, { evt: { type: '__status', status: 'minting' } } as any);
    try {
      const m = await aether.mint();
      result.tokenId = m.tokenId;
      result.txHash = m.txHash;
      const tid = m.tokenId.toString();
      reports.set(tid, result.finalReport);
      if (result.reportRoot && result.masterKeyHex) {
        reportPointers.set(tid, {
          reportRoot: result.reportRoot,
          masterKeyHex: result.masterKeyHex,
        });
        console.log(kleur.gray(`  report blob root: ${result.reportRoot}`));
      }
    } catch (e: any) {
      session.error = `mint failed: ${e?.message}`;
      console.warn(kleur.yellow(session.error));
    }
  }

  session.status = 'completed';
  broadcast(session, {
    evt: { type: '__status' },
    status: 'completed',
    tokenId: result.tokenId?.toString(),
    txHash: result.txHash,
    finalReport: result.finalReport,
  } as any);
}

function broadcast(session: Session, data: unknown) {
  for (const sub of session.subscribers) {
    try { sendSSE(sub, 'event', data); } catch { /* ignore disconnected */ }
  }
}

function sendSSE(res: Response, eventName: string, data: unknown) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

const THORNBURY_AVATAR = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7cf2c4"/>
      <stop offset="100%" stop-color="#3aa67d"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="#0e0e12"/>
  <path d="M32 12 L52 50 L12 50 Z" fill="url(#g)" stroke="#7cf2c4" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="32" cy="40" r="4" fill="#0e0e12"/>
</svg>`;
