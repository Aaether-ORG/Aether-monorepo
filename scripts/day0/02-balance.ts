/**
 * Day 0 — Check 2: Wallet has 0G testnet balance.
 */
import { ethers } from 'ethers';
import { env, ok, fail, info, heading } from './_lib.js';

const MIN_BALANCE = ethers.parseEther('0.5');

async function main() {
  heading('Day-0 Check 2: 0G testnet wallet balance');

  const provider = new ethers.JsonRpcProvider(env('ZG_RPC_URL'));
  const wallet = new ethers.Wallet(env('ZG_TESTNET_PRIVATE_KEY'), provider);
  const balance = await provider.getBalance(wallet.address);

  info(`Address: ${wallet.address}`);
  info(`Balance: ${ethers.formatEther(balance)} 0G`);

  if (balance < MIN_BALANCE) {
    fail(`Balance too low. Get tokens at https://faucet.0g.ai (or via Discord/Telegram).`);
    process.exit(1);
  }

  ok('Wallet funded.');
}

main().catch((e) => {
  fail(e.message);
  process.exit(1);
});
