/**
 * Deploys AmmoniteResolver and configures gateway URL.
 *
 * Run AFTER your CCIP gateway is reachable (e.g. https://aether-ccip.vercel.app).
 */
import { ethers, network } from 'hardhat';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

async function main() {
  const gateway = process.env.AMMONITE_CCIP_GATEWAY ??
    'https://aether-ccip.vercel.app/{sender}/{data}';

  const [deployer] = await ethers.getSigners();
  console.log(`Network:  ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Gateway:  ${gateway}`);

  const F = await ethers.getContractFactory('AmmoniteResolver');
  const resolver = await F.deploy([gateway]);
  await resolver.waitForDeployment();

  const addr = await resolver.getAddress();
  console.log(`AmmoniteResolver: ${addr}`);

  const out = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    AmmoniteResolver: addr,
    gateway,
    timestamp: new Date().toISOString(),
  };

  const dir = join(__dirname, '..', 'deployments');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${network.name}.resolver.json`), JSON.stringify(out, null, 2));
  console.log(`Saved deployments/${network.name}.resolver.json`);

  console.log('\nNext steps:');
  console.log(`1. On L1 ENS (mainnet/sepolia), point your name's resolver at this address.`);
  console.log(`2. Or wire it as the L2 resolver via Durin's setL2Registry call.`);
  console.log(`3. setText(node, "agent.services.x402", ...) for your agent's static records.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
