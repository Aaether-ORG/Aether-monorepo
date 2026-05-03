/**
 * Mint a fresh ERC-7857 iNFT to the KeeperHub Turnkey wallet's address.
 *
 * Why: KeeperHub's `execute_contract_call` signs from the org's Turnkey wallet.
 * `authorizeUsage` requires `ownerOf(tokenId) == msg.sender`. So the iNFT must
 * be owned by the KeeperHub wallet, not by our agent owner.
 *
 *   pnpm tsx scripts/setup/mint-to-keeperhub.ts
 */
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';
dotenvConfig({ path: resolve(import.meta.dirname, '..', '..', '.env') });

import { ethers } from 'ethers';
import kleur from 'kleur';

const AGENT_NFT_ABI = [
  'function mint(bytes[] _proofs, string[] _dataDescriptions, address _to) external payable returns (uint256)',
  'function ownerOf(uint256) external view returns (address)',
  'event Minted(uint256 indexed _tokenId, address indexed _creator, address indexed _owner, bytes32[] _dataHashes, string[] _dataDescriptions)',
];

async function buildPreimageProof(dataHash: string, teeWallet: ethers.Wallet): Promise<string> {
  const claim = ethers.solidityPackedKeccak256(
    ['string', 'bytes32', 'address'],
    ['PREIMAGE', dataHash, teeWallet.address],
  );
  const sig = await teeWallet.signMessage(ethers.getBytes(claim));
  return ethers.concat([dataHash, sig]);
}

async function main() {
  const ownerKey = process.env.AGENT_OWNER_PRIVATE_KEY!;
  const teeKey = process.env.AETHER_TEE_AUTHORITY_KEY!;
  const keeperhubKey = process.env.KEEPERHUB_WALLET_PRIVATE_KEY!;
  const nftAddr = process.env.AGENT_NFT_ADDRESS!;
  if (!ownerKey || !teeKey || !keeperhubKey || !nftAddr) {
    throw new Error('Missing env: AGENT_OWNER_PRIVATE_KEY / AETHER_TEE_AUTHORITY_KEY / KEEPERHUB_WALLET_PRIVATE_KEY / AGENT_NFT_ADDRESS');
  }

  const provider = new ethers.JsonRpcProvider(process.env.ZG_RPC_URL!);
  const owner = new ethers.Wallet(ownerKey, provider);
  const tee = new ethers.Wallet(teeKey);
  const recipient = new ethers.Wallet(keeperhubKey).address;

  console.log(kleur.cyan('=== Mint iNFT to KeeperHub wallet ==='));
  console.log(`Owner:     ${owner.address}`);
  console.log(`TEE auth:  ${tee.address}`);
  console.log(`Recipient: ${recipient}  (KeeperHub Turnkey wallet)`);
  console.log(`AgentNFT:  ${nftAddr}`);

  const ownerBal = await provider.getBalance(owner.address);
  console.log(`\nOwner balance:   ${ethers.formatEther(ownerBal)} 0G`);
  const recBal = await provider.getBalance(recipient);
  console.log(`Recipient bal:   ${ethers.formatEther(recBal)} 0G  (needs ~0.01 for authorizeUsage gas)`);

  // Build a single-data-hash proof. dataHash is the chained Merkle root over
  // an empty event list (so the iNFT starts fresh — its life log will grow
  // through subsequent updates).
  const dataHash = ethers.keccak256(
    ethers.toUtf8Bytes(`aether:keeperhub-owned:${Date.now()}`),
  );
  const proof = await buildPreimageProof(dataHash, tee);
  const description = `Aether iNFT for KeeperHub Guard demo @ ${new Date().toISOString()}`;

  const c = new ethers.Contract(nftAddr, AGENT_NFT_ABI, owner);
  console.log(kleur.cyan('\nMinting...'));
  const tx = await c.mint!([proof], [description], recipient);
  console.log(kleur.gray(`tx: ${process.env.ZG_EXPLORER}/tx/${tx.hash}`));
  const receipt = await tx.wait();

  // Parse Minted event for tokenId
  const minted = receipt.logs
    .map((l: any) => { try { return c.interface.parseLog(l); } catch { return null; } })
    .find((p: any) => p?.name === 'Minted');
  if (!minted) throw new Error('Minted event not found');
  const tokenId = minted.args._tokenId as bigint;

  console.log(kleur.green(`\n✓ Minted iNFT #${tokenId} to ${recipient}`));
  console.log(kleur.gray(`Verify: cast call ${nftAddr} "ownerOf(uint256)(address)" ${tokenId} --rpc-url ${process.env.ZG_RPC_URL}`));

  // Verify ownerOf matches
  const onChainOwner = await c.ownerOf!(tokenId);
  console.log(kleur.gray(`On-chain owner: ${onChainOwner}`));
  if (onChainOwner.toLowerCase() !== recipient.toLowerCase()) {
    console.warn(kleur.yellow('⚠ On-chain owner does NOT match recipient!'));
  } else {
    console.log(kleur.green('✓ On-chain owner matches KeeperHub wallet'));
  }

  console.log(kleur.cyan('\nNext:'));
  console.log(`  Add to .env:  AETHER_TOKEN_ID=${tokenId}`);
  console.log('  Then re-run pnpm tsx scripts/e2e/buyer-flow.ts');
}

main().catch((e) => { console.error(e?.shortMessage ?? e?.message ?? e); process.exit(1); });
