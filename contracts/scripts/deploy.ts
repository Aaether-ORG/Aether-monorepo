import { ethers, network } from 'hardhat';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Deploys AetherVerifier on the configured network.
 * The TEE authority defaults to the deployer's address. Override via
 * env `AETHER_TEE_AUTHORITY_ADDRESS`.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const authority = process.env.AETHER_TEE_AUTHORITY_ADDRESS ?? deployer.address;

  console.log('=== Aether deploy ===');
  console.log('Network    :', network.name);
  console.log('Deployer   :', deployer.address);
  console.log('Authority  :', authority);
  console.log('Balance    :', ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  const AetherVerifier = await ethers.getContractFactory('AetherVerifier');
  const verifier = await AetherVerifier.deploy(authority);
  await verifier.waitForDeployment();

  const verifierAddr = await verifier.getAddress();
  console.log('AetherVerifier:', verifierAddr);

  const out = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    authority,
    contracts: { AetherVerifier: verifierAddr },
    timestamp: new Date().toISOString(),
  };

  const outDir = join(__dirname, '..', 'deployments');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${network.name}.json`);
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log('Saved →', outPath);

  console.log('\nNext steps:');
  console.log('1. Set AETHER_VERIFIER_ADDRESS=' + verifierAddr + ' in .env');
  console.log('2. Clone 0glabs/0g-agent-nft and deploy AgentNFT pointing to this verifier');
  console.log('3. Run pnpm day0:storage to verify the full stack');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
