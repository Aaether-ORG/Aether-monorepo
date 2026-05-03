/**
 * Initialize the 0G Compute ledger and fund it.
 *
 *   pnpm tsx scripts/setup/init-ledger.ts [amount=0.5]
 *
 * Required before any inference call. Creates the on-chain account that
 * pays providers per request.
 */
import 'dotenv/config';
import { ethers } from 'ethers';
import { createRequire } from 'node:module';
import kleur from 'kleur';

const require = createRequire(import.meta.url);
const { createZGComputeNetworkBroker } = require('@0gfoundation/0g-compute-ts-sdk');

async function main() {
  const amount = Number(process.argv[2] ?? '0.5');

  const provider = new ethers.JsonRpcProvider(process.env.ZG_RPC_URL!);
  const wallet = new ethers.Wallet(process.env.ZG_TESTNET_PRIVATE_KEY!, provider);
  console.log(kleur.cyan('=== 0G Compute ledger setup ==='));
  console.log(`Wallet:   ${wallet.address}`);
  console.log(`Balance:  ${ethers.formatEther(await provider.getBalance(wallet.address))} 0G`);
  console.log(`Amount:   ${amount} 0G`);

  const broker = await createZGComputeNetworkBroker(wallet);

  // Try addLedger first (creates account). If account already exists, use depositFund.
  try {
    console.log(kleur.gray('\nCreating ledger account...'));
    await broker.ledger.addLedger(amount);
    console.log(kleur.green(`✓ Ledger created and funded with ${amount} 0G`));
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('exists')) {
      console.log(kleur.gray('Account already exists; depositing more funds...'));
      await broker.ledger.depositFund(amount);
      console.log(kleur.green(`✓ Deposited ${amount} 0G`));
    } else {
      throw e;
    }
  }

  // Show current state
  const ledger = await broker.ledger.getLedger();
  console.log(kleur.gray(`\nLedger state:`));
  console.log(kleur.gray(`  totalBalance: ${ledger?.totalBalance ?? '?'}`));
  console.log(kleur.gray(`  locked:       ${ledger?.locked ?? '?'}`));
  console.log(kleur.gray(`  available:    ${ledger?.available ?? '?'}`));

  // Acknowledge default provider so we can call it
  const providerAddr = process.env.ZG_COMPUTE_PROVIDER_ADDRESS;
  if (providerAddr) {
    console.log(kleur.cyan(`\nAcknowledging provider ${providerAddr}...`));
    try {
      await broker.inference.acknowledgeProviderSigner(providerAddr);
      console.log(kleur.green(`✓ Provider acknowledged`));
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.toLowerCase().includes('already')) {
        console.log(kleur.gray('  (already acknowledged)'));
      } else {
        console.warn(kleur.yellow(`  warning: ${msg}`));
      }
    }
  }

  console.log(kleur.green('\n✓ Compute ledger ready'));
}

main().catch((e) => {
  console.error(kleur.red(`fatal: ${e?.shortMessage ?? e?.message ?? e}`));
  process.exit(1);
});
