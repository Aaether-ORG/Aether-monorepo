/**
 * Deploy AgentNFT (0G's reference, single-tx non-proxy variant) on 0G Galileo.
 * Pointed at our previously-deployed AetherVerifier.
 *
 *   pnpm hardhat run scripts/deploy-agentnft-direct.ts --network zgTestnet
 */
import { ethers, network } from 'hardhat';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

async function main() {
  const [deployer] = await ethers.getSigners();
  const verifierAddr = process.env.AETHER_VERIFIER_ADDRESS;
  if (!verifierAddr) {
    throw new Error('AETHER_VERIFIER_ADDRESS not set. Run pnpm deploy:zg first.');
  }

  console.log('=== Deploy AgentNFT (0G reference, single-tx) ===');
  console.log(`Network:       ${network.name}`);
  console.log(`Deployer:      ${deployer.address}`);
  console.log(`Verifier:      ${verifierAddr}`);
  console.log(`Balance:       ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} 0G`);

  const F = await ethers.getContractFactory('AgentNFT');
  console.log('\nDeploying AgentNFT...');
  const nft = await F.deploy(
    'Aether Agents',
    'AETHER',
    verifierAddr,
    process.env.ZG_RPC_URL ?? 'https://evmrpc-testnet.0g.ai',
    process.env.ZG_INDEXER_RPC_URL ?? 'https://indexer-storage-testnet-turbo.0g.ai',
  );
  await nft.waitForDeployment();
  const nftAddr = await nft.getAddress();
  console.log(`✓ AgentNFT: ${nftAddr}`);

  // Sanity verify
  const v = await nft.verifier();
  if (v.toLowerCase() !== verifierAddr.toLowerCase()) {
    throw new Error(`Verifier mismatch: contract has ${v}, expected ${verifierAddr}`);
  }
  console.log(`✓ verifier() returns AetherVerifier`);

  // Update or merge with existing deployment file
  const dir = join(__dirname, '..', 'deployments');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const path = join(dir, `${network.name}.json`);
  const existing = existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : {};
  const out = {
    ...existing,
    contracts: {
      ...(existing.contracts ?? {}),
      AgentNFT: nftAddr,
    },
    AgentNFT: nftAddr,
    timestamp: new Date().toISOString(),
  };
  writeFileSync(path, JSON.stringify(out, null, 2));
  console.log(`Saved → ${path}`);

  console.log('\nNext:');
  console.log(`  Add to .env:  AGENT_NFT_ADDRESS=${nftAddr}`);
}

main().catch((e) => {
  console.error(e?.shortMessage ?? e?.message ?? e);
  process.exit(1);
});
