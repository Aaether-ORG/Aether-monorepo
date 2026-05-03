/**
 * Quick balance check across all networks we use.
 *   pnpm tsx scripts/check-balance.ts
 */
import 'dotenv/config';
import { ethers } from 'ethers';

const networks: { name: string; rpc: string; symbol: string }[] = [
  { name: '0G Galileo',     rpc: process.env.ZG_RPC_URL ?? 'https://evmrpc-testnet.0g.ai',         symbol: '0G' },
  { name: 'Sepolia',        rpc: process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia.publicnode.com', symbol: 'ETH' },
  { name: 'Base Sepolia',   rpc: process.env.BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org',       symbol: 'ETH' },
];

async function main() {
  const pk = process.env.SEPOLIA_PRIVATE_KEY ?? process.env.ZG_TESTNET_PRIVATE_KEY;
  if (!pk) throw new Error('No private key found in .env');
  const wallet = new ethers.Wallet(pk);
  console.log(`Address: ${wallet.address}\n`);
  for (const n of networks) {
    try {
      const p = new ethers.JsonRpcProvider(n.rpc);
      const b = await p.getBalance(wallet.address);
      console.log(`  ${n.name.padEnd(15)} ${ethers.formatEther(b)} ${n.symbol}`);
    } catch (e: any) {
      console.log(`  ${n.name.padEnd(15)} unreachable: ${e?.shortMessage ?? e?.message}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
