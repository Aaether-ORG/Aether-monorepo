import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '..', '..', '.env') });

import { ethers } from 'ethers';

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.ZG_RPC_URL!);
  const tok = new ethers.Contract(
    process.env.ZGUSD_ADDRESS!,
    ['function balanceOf(address) view returns (uint256)'],
    provider,
  );
  const buyer = '0x6e1a4201172f81a06E70cA176076B94e42e371f3'; // KeeperHub wallet (current MetaMask)
  const seller = process.env.AGENT_PAYMENT_ADDRESS!;
  const b: bigint = await (tok as any).balanceOf(buyer);
  const s: bigint = await (tok as any).balanceOf(seller);
  console.log(`Buyer  ZGUSD: ${ethers.formatUnits(b, 6)}`);
  console.log(`Seller ZGUSD: ${ethers.formatUnits(s, 6)}`);
}
main().catch(console.error);
