import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';
dotenvConfig({ path: resolve(import.meta.dirname, '..', '..', '.env') });
import { ethers } from 'ethers';

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.ZG_RPC_URL!);
  const KH = new ethers.Wallet(process.env.KEEPERHUB_WALLET_PRIVATE_KEY!).address;
  const NFT = process.env.AGENT_NFT_ADDRESS!;

  console.log('KeeperHub wallet:', KH);
  console.log('AgentNFT:        ', NFT);
  console.log('Nonce:           ', await provider.getTransactionCount(KH));
  console.log('Balance:         ', ethers.formatEther(await provider.getBalance(KH)), '0G');

  const c = new ethers.Contract(NFT, [
    'function ownerOf(uint256) view returns (address)',
    'function authorizedUsersOf(uint256) view returns (address[])',
  ], provider);
  console.log('Token 1 owner:   ', await (c as any).ownerOf(1));
  const auth = await (c as any).authorizedUsersOf(1);
  console.log('Token 1 authorized:', auth);
}
main().catch(console.error);
