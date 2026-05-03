/**
 * Deploy ZGUSD on 0G Galileo + mint test funds to:
 *   - the agent owner wallet (for sale receivers)
 *   - the KeeperHub Turnkey wallet (so the buy flow has something to sign over)
 *
 *   pnpm hardhat run scripts/deploy-zgusd.ts --network zgTestnet
 */
import { ethers, network } from 'hardhat';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('=== Deploy ZGUSD on 0G Galileo ===');
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} 0G`);

  const F = await ethers.getContractFactory('ZGUSD');
  const tok = await F.deploy();
  await tok.waitForDeployment();
  const addr = await tok.getAddress();
  console.log(`✓ ZGUSD: ${addr}`);
  console.log(`  name:   ${await tok.name()}`);
  console.log(`  symbol: ${await tok.symbol()}`);
  console.log(`  decimals: ${await tok.decimals()}`);

  // Mint to deployer (agent owner) — 100,000 ZGUSD
  const decimals = Number(await tok.decimals());
  const oneToken = 10n ** BigInt(decimals);
  const mintTx = await tok.mint(deployer.address, 100_000n * oneToken);
  await mintTx.wait();
  console.log(`✓ Minted 100,000 ZGUSD to ${deployer.address}`);

  // Mint to KeeperHub Turnkey wallet too (so the buyer has funds to sign over)
  // Address derived deterministically from the env private key — we don't need
  // the key, just the address, so we read from the .env-supplied address.
  const kh = process.env.KEEPERHUB_WALLET_ADDRESS;
  if (kh && /^0x[a-fA-F0-9]{40}$/.test(kh)) {
    const mintTx2 = await tok.mint(kh, 1_000n * oneToken);
    await mintTx2.wait();
    console.log(`✓ Minted 1,000 ZGUSD to KeeperHub wallet ${kh}`);
  }

  // Save deployment
  const dir = join(__dirname, '..', 'deployments');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const path = join(dir, `${network.name}.json`);
  const existing = existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : {};
  const out = {
    ...existing,
    contracts: { ...(existing.contracts ?? {}), ZGUSD: addr },
    ZGUSD: addr,
    timestamp: new Date().toISOString(),
  };
  writeFileSync(path, JSON.stringify(out, null, 2));
  console.log(`Saved → deployments/${network.name}.json`);

  console.log('\nNext: add to .env');
  console.log(`  ZGUSD_ADDRESS=${addr}`);
}

main().catch((e) => { console.error(e?.shortMessage ?? e?.message ?? e); process.exit(1); });
