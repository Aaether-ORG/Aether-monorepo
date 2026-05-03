/**
 * Day 0 — Check 9: KeeperHub MCP reachable + auth works.
 *
 * The KeeperHub MCP server is at https://app.keeperhub.com/mcp and uses the
 * 2025-06-18 MCP HTTP transport with session IDs. We:
 *   1. POST initialize → get mcp-session-id
 *   2. Send notifications/initialized
 *   3. Call tools/list to enumerate available tools
 */
import { env, ok, fail, info, heading, optionalEnv } from './_lib.js';

async function main() {
  heading('Day-0 Check 9: KeeperHub MCP');

  const url = env('KEEPERHUB_MCP_URL', 'https://app.keeperhub.com/mcp');
  const token = optionalEnv('KEEPERHUB_TOKEN');
  info(`MCP URL: ${url}`);

  if (!token) {
    fail('KEEPERHUB_TOKEN not set in .env');
    info('  → Get a key from https://app.keeperhub.com/settings/api-keys');
    process.exit(1);
  }

  // 1. initialize
  info('Initializing MCP session...');
  const initRes = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'aether-day0', version: '0.1.0' },
      },
    }),
  });
  if (!initRes.ok) {
    fail(`initialize failed: ${initRes.status} ${await initRes.text()}`);
    process.exit(1);
  }
  const sessionId = initRes.headers.get('mcp-session-id');
  if (!sessionId) {
    fail('No mcp-session-id header in initialize response');
    process.exit(1);
  }
  ok(`Session established (${sessionId.slice(0, 14)}…)`);

  // 2. notifications/initialized
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${token}`,
      'mcp-session-id': sessionId,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    }),
  });

  // 3. tools/list
  info('Listing tools...');
  const toolsRes = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${token}`,
      'mcp-session-id': sessionId,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
  });
  const text = await toolsRes.text();
  // Server may return SSE; parse out the data: line
  let parsed: any;
  if (text.includes('data:')) {
    const dataLine = text.split('\n').find((l) => l.startsWith('data:'));
    if (dataLine) parsed = JSON.parse(dataLine.slice(5).trim());
  } else {
    parsed = JSON.parse(text);
  }
  const tools: any[] = parsed?.result?.tools ?? [];
  ok(`${tools.length} tools available.`);
  // Highlight the ones Aether will use
  const wanted = ['execute_contract_call', 'execute_transfer', 'create_workflow', 'execute_workflow'];
  for (const w of wanted) {
    const t = tools.find((x: any) => x.name === w);
    info(`  ${t ? '✓' : '✗'} ${w}${t ? '' : ' (missing!)'}`);
  }
}

main().catch((e) => {
  fail(e?.message ?? String(e));
  process.exit(1);
});
