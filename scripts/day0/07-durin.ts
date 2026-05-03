/**
 * Day 0 — Check 7: Durin L2 factory reachable on Base Sepolia.
 */
import { ethers } from 'ethers';
import { env, ok, fail, info, heading } from './_lib.js';

async function main() {
  heading('Day-0 Check 7: Durin L2 subname factory');

  const factoryAddr = env('DURIN_FACTORY');
  const baseSepolia = new ethers.JsonRpcProvider(
    process.env.BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org',
  );

  info(`Factory: ${factoryAddr}`);
  info('Target chain: Base Sepolia (84532)');

  const code = await baseSepolia.getCode(factoryAddr);
  if (code === '0x') {
    fail(`No code at ${factoryAddr} on Base Sepolia.`);
    process.exit(1);
  }
  ok(`Factory contract live (${code.length / 2 - 1} bytes).`);
  info('Next: visit https://durin.dev to deploy your L2 registry interactively.');
  info('Then: set DURIN_L2_REGISTRY=0x... in .env');
}

main().catch((e) => {
  fail(e.message);
  process.exit(1);
});
