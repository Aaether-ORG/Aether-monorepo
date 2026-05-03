/**
 * Convenience: run one research pass via a running Thornbury server.
 * Call this AFTER `pnpm thornbury:server` is up.
 */
import 'dotenv/config';

const SERVER = process.env.THORNBURY_SERVER ?? 'http://localhost:3000';

async function main() {
  const question = process.argv.slice(2).join(' ') ||
    'What are the most cited cell-free protein synthesis papers from Q1 2026?';

  console.log(`POST ${SERVER}/research with question: ${question}`);
  const r = await fetch(`${SERVER}/research`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!r.ok) {
    console.error('Server error:', r.status, await r.text());
    process.exit(1);
  }
  const { sessionId } = await r.json();
  console.log(`Session: ${sessionId}`);
  console.log(`Streaming events from ${SERVER}/sessions/${sessionId}/events ...`);

  // Subscribe to SSE
  const events = new EventSource(`${SERVER}/sessions/${sessionId}/events`);
  events.addEventListener('event', (e) => {
    const data = JSON.parse((e as any).data);
    if (data.evt?.type) console.log('  ·', data.evt.type, data.eventHash?.slice?.(0, 12) ?? '');
    if (data.status === 'completed') {
      console.log('\n✓ Done.');
      if (data.tokenId) console.log(`  iNFT #${data.tokenId}`);
      if (data.txHash) console.log(`  tx: ${process.env.ZG_EXPLORER}/tx/${data.txHash}`);
      events.close();
      process.exit(0);
    }
    if (data.evt?.type === '__error') {
      console.error('Error:', data.evt.error);
      events.close();
      process.exit(1);
    }
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
