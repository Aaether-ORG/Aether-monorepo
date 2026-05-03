/**
 * Day 0 — Check 1: 0G Galileo testnet RPC reachable.
 */
import { ethers } from 'ethers';
import { env, ok, fail, info, heading } from './_lib.js';

async function main() {
  heading('Day-0 Check 1: 0G testnet RPC');

  const url = env('ZG_RPC_URL');
  info(`RPC: ${url}`);

  const provider = new ethers.JsonRpcProvider(url);
  const network = await provider.getNetwork();
  const block = await provider.getBlockNumber();

  if (Number(network.chainId) !== Number(env('ZG_CHAIN_ID', '16601'))) {
    fail(`Chain ID mismatch: got ${network.chainId}, expected ${env('ZG_CHAIN_ID')}`);
    process.exit(1);
  }

  ok(`Connected to chainId ${network.chainId}`);
  ok(`Block number: ${block}`);
}

main().catch((e) => {
  fail(e.message);
  process.exit(1);
});
