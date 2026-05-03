/**
 * Deploy DurinL2Registrar on Base Sepolia and authorize it on the L2 Registry.
 * Combines durin.dev's step 3 + 4 in one shot.
 *
 *   pnpm deploy:registrar    (resolves to: hardhat run scripts/deploy-registrar.ts --network baseSepolia)
 */
import { ethers, network } from 'hardhat';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

async function main() {
  const registryAddr = process.env.DURIN_L2_REGISTRY;
  if (!registryAddr) throw new Error('DURIN_L2_REGISTRY not set in .env');

  const [deployer] = await ethers.getSigners();
  console.log('=== Deploy DurinL2Registrar ===');
  console.log(`Network:       ${network.name}`);
  console.log(`Deployer:      ${deployer.address}`);
  console.log(`L2 Registry:   ${registryAddr}`);
  console.log(`Balance:       ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

  // 1. Deploy the registrar pointing at the user's L2 registry
  const F = await ethers.getContractFactory('DurinL2Registrar');
  console.log('\nDeploying registrar...');
  const reg = await F.deploy(registryAddr);
  await reg.waitForDeployment();
  const registrarAddr = await reg.getAddress();
  console.log(`✓ DurinL2Registrar: ${registrarAddr}`);

  // 2. Authorize the registrar on the L2 registry
  console.log('\nAuthorizing registrar on L2 registry...');
  const registry = await ethers.getContractAt(
    [
      'function addRegistrar(address registrar) external',
      'function registrars(address) external view returns (bool)',
      'function owner() external view returns (address)',
    ],
    registryAddr,
    deployer,
  );

  const ownerAddr = await registry.owner();
  if (ownerAddr.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`L2 registry owner is ${ownerAddr}, deployer is ${deployer.address}. Use the registry owner key.`);
  }

  const already = await registry.registrars(registrarAddr);
  if (already) {
    console.log('  registrar already authorized — skipping addRegistrar');
  } else {
    const tx = await registry.addRegistrar(registrarAddr);
    console.log(`  tx: ${tx.hash}`);
    await tx.wait();
    console.log('  ✓ Authorized');
  }

  // Save
  const out = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    L2Registry: registryAddr,
    DurinL2Registrar: registrarAddr,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };

  const dir = join(__dirname, '..', 'deployments');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${network.name}.registrar.json`), JSON.stringify(out, null, 2));
  console.log(`\nSaved deployments/${network.name}.registrar.json`);

  console.log('\nNext:');
  console.log(`  1. Add to .env:  DURIN_L2_REGISTRAR=${registrarAddr}`);
  console.log('  2. Mint your first subname (e.g. thornbury.aaether.eth):');
  console.log('     pnpm tsx layers/ammonite/scripts/setup-subname.ts thornbury');
}

main().catch((e) => {
  console.error('FAILED:', e?.shortMessage ?? e?.message ?? e);
  process.exit(1);
});
