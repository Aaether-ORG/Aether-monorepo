/**
 * Day 0 — Check 6: ERC-8004 contracts on Sepolia reachable.
 */
import { ethers } from 'ethers';
import { env, ok, fail, info, heading } from './_lib.js';

const IDENTITY_ABI = [
  'function ownerOf(uint256) external view returns (address)',
];

async function main() {
  heading('Day-0 Check 6: ERC-8004 Sepolia');

  const provider = new ethers.JsonRpcProvider(env('SEPOLIA_RPC_URL'));
  const id = env('ERC8004_IDENTITY');
  const rep = env('ERC8004_REPUTATION');

  info(`IdentityRegistry:   ${id}`);
  info(`ReputationRegistry: ${rep}`);

  const code1 = await provider.getCode(id);
  const code2 = await provider.getCode(rep);

  if (code1 === '0x') { fail(`No code at ${id}`); process.exit(1); }
  if (code2 === '0x') { fail(`No code at ${rep}`); process.exit(1); }

  ok(`Identity contract live (${code1.length / 2 - 1} bytes)`);
  ok(`Reputation contract live (${code2.length / 2 - 1} bytes)`);

  // Try to read agent #1 (might not exist)
  const c = new ethers.Contract(id, IDENTITY_ABI, provider);
  try {
    const owner = await c.ownerOf(1n);
    info(`Agent #1 owner: ${owner}`);
  } catch {
    info('Agent #1 not registered (expected on fresh testnet).');
  }
}

main().catch((e) => {
  fail(e.message);
  process.exit(1);
});
