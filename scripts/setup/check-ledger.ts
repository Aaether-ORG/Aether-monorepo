import 'dotenv/config';
import { ethers } from 'ethers';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createZGComputeNetworkBroker } = require('@0gfoundation/0g-compute-ts-sdk');

const provider = new ethers.JsonRpcProvider(process.env.ZG_RPC_URL!);
const wallet = new ethers.Wallet(process.env.ZG_TESTNET_PRIVATE_KEY!, provider);
const broker = await createZGComputeNetworkBroker(wallet);

const bal = await provider.getBalance(wallet.address);
console.log('Wallet balance:', ethers.formatEther(bal), '0G');

try {
  const ledger = await broker.ledger.getLedger();
  console.log('Ledger:', JSON.stringify(ledger, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
} catch (e: any) {
  console.log('No ledger yet:', e?.message);
}

const provAddr = process.env.ZG_COMPUTE_PROVIDER_ADDRESS;
if (provAddr) {
  try {
    await broker.inference.acknowledgeProviderSigner(provAddr);
    console.log('Acknowledged provider:', provAddr);
  } catch (e: any) {
    if (String(e?.message).toLowerCase().includes('already')) {
      console.log('Provider already acknowledged');
    } else {
      console.log('Acknowledge error:', e?.message);
    }
  }
}
