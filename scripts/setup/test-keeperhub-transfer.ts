/**
 * Test KeeperHub's `execute_transfer` MCP tool on 0G Galileo.
 * Simpler than execute_contract_call — no simulation/gas-estimation gymnastics.
 *
 * If this works, KeeperHub is fine for 0G — the issue is specific to
 * execute_contract_call's pre-broadcast logic.
 */
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';
dotenvConfig({ path: resolve(import.meta.dirname, '..', '..', '.env') });

import { Wallet } from 'ethers';

const TOKEN = process.env.KEEPERHUB_TOKEN!;
const MCP = process.env.KEEPERHUB_MCP_URL!;
const RECIPIENT = new Wallet(process.env.AGENT_OWNER_PRIVATE_KEY!).address;

async function main() {
  console.log(`Recipient: ${RECIPIENT}`);

  // Initialize MCP session
  const init = await fetch(MCP, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } },
    }),
  });
  const session = init.headers.get('mcp-session-id');
  if (!session) throw new Error('no session');
  console.log(`Session: ${session.slice(0, 16)}...`);

  await fetch(MCP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
               Authorization: `Bearer ${TOKEN}`, 'mcp-session-id': session },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
  });

  // Get execute_transfer schema first
  const sch = await fetch(MCP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
               Authorization: `Bearer ${TOKEN}`, 'mcp-session-id': session },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
  });
  const schT = await sch.text();
  let schJ: any;
  if (schT.includes('data:')) {
    schJ = JSON.parse(schT.split('\n').find((l) => l.startsWith('data:'))!.slice(5).trim());
  } else { schJ = JSON.parse(schT); }
  const transferTool = schJ.result.tools.find((t: any) => t.name === 'execute_transfer');
  console.log('execute_transfer schema:', JSON.stringify(transferTool?.inputSchema, null, 2));

  // Make a tiny transfer (0.001 0G) from KeeperHub wallet → agent owner
  console.log('\nCalling execute_transfer (timeout 100s)...');
  const start = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort('client-timeout'), 100_000);
  try {
    const res = await fetch(MCP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
                 Authorization: `Bearer ${TOKEN}`, 'mcp-session-id': session },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 3, method: 'tools/call',
        params: {
          name: 'execute_transfer',
          arguments: {
            network: process.env.TEST_NETWORK ?? '16602',
            recipient_address: RECIPIENT,
            amount: '0.0001',
            // token_address omitted = native token
          },
        },
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    console.log(`Status: ${res.status}, elapsed: ${Date.now() - start}ms`);
    const t = await res.text();
    let parsed: any;
    if (t.includes('data:')) {
      parsed = JSON.parse(t.split('\n').find((l) => l.startsWith('data:'))!.slice(5).trim());
    } else { parsed = JSON.parse(t); }
    const text = parsed?.result?.content?.[0]?.text;
    console.log('Result:', text ?? JSON.stringify(parsed).slice(0, 500));
  } catch (e: any) {
    console.log(`Aborted after ${Date.now() - start}ms — ${e?.message ?? e}`);
  }
}

main().catch(console.error);
