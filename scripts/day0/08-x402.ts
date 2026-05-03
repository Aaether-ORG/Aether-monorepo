/**
 * Day 0 — Check 8: x402 facilitator health check.
 */
import { env, ok, fail, info, heading } from './_lib.js';

async function main() {
  heading('Day-0 Check 8: x402 facilitator');

  const url = env('X402_FACILITATOR');
  info(`Facilitator: ${url}`);

  // Try a few likely health URLs.
  const candidates = [
    `${url}/health`,
    `${url}`,
    'https://api.cdp.coinbase.com/platform/v2/x402/health',
  ];

  let okFlag = false;
  for (const u of candidates) {
    try {
      const r = await fetch(u, { method: 'GET' });
      if (r.ok || r.status === 401 || r.status === 403) {
        ok(`Reachable: ${u} (status ${r.status})`);
        okFlag = true;
        break;
      }
      info(`  ${u} → ${r.status}`);
    } catch (e: any) {
      info(`  ${u} → fetch error: ${e.message}`);
    }
  }
  if (!okFlag) {
    fail('Could not reach any x402 facilitator endpoint. Verify URL or try mainnet variant.');
    process.exit(1);
  }
}

main().catch((e) => {
  fail(e.message);
  process.exit(1);
});
