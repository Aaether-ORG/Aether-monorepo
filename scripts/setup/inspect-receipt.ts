import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';
dotenvConfig({ path: resolve(import.meta.dirname, '..', '..', '.env') });
import { ethers } from 'ethers';

async function main() {
  const txHash = process.argv[2] || '0x49075445312453bd86f3556d7c5f0a8997f58edb20b3e44502df228fe5980efb';
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const r = await provider.getTransactionReceipt(txHash);
  console.log('Status:', r?.status, 'Logs:', r?.logs.length);
  r?.logs.forEach((log, i) => {
    console.log(`Log ${i}: addr=${log.address}`);
    log.topics.forEach((t, j) => console.log(`  topic[${j}] = ${t}`));
    console.log(`  data = ${log.data.slice(0, 200)}${log.data.length > 200 ? '...' : ''}`);
  });
}

main();
