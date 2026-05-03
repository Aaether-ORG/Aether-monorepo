/**
 * End-to-end demo flow runner.
 *
 * Assumes services are running (use `pnpm e2e` in another terminal).
 * Hits Thornbury → research → mint → buy → replay.
 *
 *   pnpm tsx scripts/e2e/demo-flow.ts "Your question"
 */
import 'dotenv/config';
import kleur from 'kleur';

const THORNBURY = process.env.THORNBURY_URL ?? 'http://localhost:3000';
const AMMONITE = process.env.AMMONITE_URL ?? 'http://localhost:8080';

async function main() {
  const question = process.argv.slice(2).join(' ') ||
    'What are the most cited cell-free protein synthesis papers from Q1 2026?';

  console.log(kleur.cyan('1) Health-check services'));
  await ping(THORNBURY + '/health', 'thornbury');
  await ping(AMMONITE + '/health', 'ammonite');

  console.log(kleur.cyan(`\n2) POST /research with question: ${question}`));
  const r1 = await fetch(`${THORNBURY}/research`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!r1.ok) throw new Error(`research kickoff failed: ${r1.status} ${await r1.text()}`);
  const { sessionId } = await r1.json();
  console.log(kleur.gray(`   sessionId: ${sessionId}`));

  console.log(kleur.cyan('\n3) Subscribe to events (SSE)'));
  let tokenId: string | undefined;
  await new Promise<void>((doneWaiting, fail) => {
    const es = new EventSource(`${THORNBURY}/sessions/${sessionId}/events`);
    es.addEventListener('event', (e) => {
      const data = JSON.parse((e as any).data);
      if (data.evt?.type) {
        console.log(kleur.gray(`   · ${data.evt.type}  ${data.eventHash?.slice?.(0, 12) ?? ''}`));
      }
      if (data.status === 'completed') {
        tokenId = data.tokenId;
        es.close();
        doneWaiting();
      }
      if (data.evt?.error) {
        es.close();
        fail(new Error(data.evt.error));
      }
    });
    es.onerror = () => {
      es.close();
      fail(new Error('SSE connection error'));
    };
  });

  console.log(kleur.cyan(`\n4) Session completed${tokenId ? `, token #${tokenId}` : ''}`));

  if (!tokenId) {
    console.log(kleur.yellow('   No iNFT minted (AGENT_NFT_ADDRESS likely unset). Skipping buy/replay.'));
    return;
  }

  console.log(kleur.cyan(`\n5) GET /report/${tokenId}  (expect HTTP 402)`));
  const r402 = await fetch(`${THORNBURY}/report/${tokenId}`);
  console.log(kleur.gray(`   status: ${r402.status}`));
  console.log(kleur.gray(`   PAYMENT-REQUIRED: ${r402.headers.get('PAYMENT-REQUIRED')?.slice(0, 60)}…`));

  console.log(kleur.cyan(`\n6) Re-fetch with PAYMENT-SIGNATURE (mock signature)`));
  const r200 = await fetch(`${THORNBURY}/report/${tokenId}`, {
    headers: { 'PAYMENT-SIGNATURE': 'demo-signature-' + Date.now(), 'X-Buyer-Address': '0xDEADBEEF' },
  });
  if (!r200.ok) {
    console.log(kleur.red(`   failed: ${r200.status} ${await r200.text()}`));
  } else {
    const j = await r200.json();
    console.log(kleur.green('   report unlocked ✓'));
    console.log(kleur.gray(`   ${(j.report as string).slice(0, 80)}…`));
  }

  console.log(kleur.cyan(`\n7) GET /agent/${tokenId}/replay`));
  const replay = await fetch(`${THORNBURY}/agent/${tokenId}/replay`);
  if (replay.ok) {
    const r = await replay.json();
    console.log(kleur.green(`   chain head: ${r.chainHead?.slice?.(0, 12)}…`));
    console.log(kleur.gray(`   events: ${r.events.length}`));
  }

  console.log(kleur.cyan('\n8) GET ENS dynamic agent.aether.head from Ammonite gateway'));
  const head = await fetch(`${AMMONITE}/lookup?key=agent.aether.head`);
  if (head.ok) {
    const j = await head.json();
    console.log(kleur.green(`   resolved: ${j.value?.slice?.(0, 14)}…`));
  }

  console.log(kleur.cyan('\n✓ Demo flow complete.'));
}

async function ping(url: string, name: string) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (r.ok) console.log(kleur.green(`   ✓ ${name} reachable`));
    else throw new Error(`${name} HTTP ${r.status}`);
  } catch (e: any) {
    console.log(kleur.red(`   ✗ ${name} unreachable: ${e.message}`));
    throw e;
  }
}

main().catch((e) => {
  console.error(kleur.red(`\nFAILED: ${e?.message ?? e}`));
  process.exit(1);
});
