/**
 * Day 0 — Check 10: ENS resolution works (mainnet, sanity check).
 */
import { ethers } from 'ethers';
import { ok, fail, info, heading } from './_lib.js';

async function main() {
  heading('Day-0 Check 10: ENS resolution');

  const mainnet = new ethers.JsonRpcProvider(
    process.env.MAINNET_RPC ?? 'https://eth.llamarpc.com',
  );
  const target = 'vitalik.eth';
  info(`Resolving ${target} on mainnet...`);

  const addr = await mainnet.resolveName(target);
  if (!addr) {
    fail('ENS resolution failed.');
    process.exit(1);
  }
  ok(`${target} → ${addr}`);

  info('ENS infrastructure reachable. For agent subnames you\'ll deploy via Durin.');
}

main().catch((e) => {
  fail(e.message);
  process.exit(1);
});
