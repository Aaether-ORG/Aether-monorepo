/**
 * Helper script: Clones 0glabs/0g-agent-nft, swaps in our verifier address,
 * and deploys AgentNFT to 0G Galileo testnet.
 *
 * Usage:
 *   1. pnpm hardhat run scripts/deploy.ts --network zgTestnet
 *   2. Set AETHER_VERIFIER_ADDRESS in ../.env
 *   3. pnpm tsx scripts/deploy-agentnft.ts
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(__dirname, '..', '..', '.env') });

const REPO_DIR = join(__dirname, '..', '..', '.cache', '0g-agent-nft');
const VERIFIER = process.env.AETHER_VERIFIER_ADDRESS;

if (!VERIFIER) {
  console.error('ERROR: AETHER_VERIFIER_ADDRESS not set in .env');
  console.error('       Run `pnpm deploy:zg` first to deploy AetherVerifier.');
  process.exit(1);
}

const sh = (cmd: string, opts: any = {}) => {
  console.log('$', cmd);
  return execSync(cmd, { stdio: 'inherit', ...opts });
};

console.log('=== Deploy AgentNFT (0glabs reference) ===');
console.log('Verifier:', VERIFIER);

// 1. Clone if missing
if (!existsSync(REPO_DIR)) {
  mkdirSync(join(__dirname, '..', '..', '.cache'), { recursive: true });
  sh(`git clone https://github.com/0glabs/0g-agent-nft.git ${REPO_DIR}`);
  sh(`git -C ${REPO_DIR} checkout eip-7857-draft`);
}

// 2. Set up env in clone
const cloneEnv = `
ZG_TESTNET_PRIVATE_KEY=${process.env.ZG_TESTNET_PRIVATE_KEY}
ZG_AGENT_NFT_CREATOR_PRIVATE_KEY=${process.env.ZG_TESTNET_PRIVATE_KEY}
AETHER_VERIFIER_ADDRESS=${VERIFIER}
`.trim();
writeFileSync(join(REPO_DIR, '.env'), cloneEnv);

// 3. Install + compile
sh('pnpm install', { cwd: REPO_DIR });
sh('pnpm hardhat compile', { cwd: REPO_DIR });

// 4. Deploy. NOTE: the reference repo's deploy script may need patching to
//    accept our verifier address. Inspect ./scripts/deploy/ inside the clone
//    and ensure it uses process.env.AETHER_VERIFIER_ADDRESS instead of deploying
//    the bundled verifier.
console.log('\n>>> About to deploy. If the reference repo deploys its own verifier,');
console.log('    edit the clone\'s deploy script to use AETHER_VERIFIER_ADDRESS instead.\n');
sh('pnpm hardhat deploy --network zgTestnet', { cwd: REPO_DIR });

console.log('\n=== Done ===');
console.log('Capture the AgentNFT address printed above and add to .env:');
console.log('  AGENT_NFT_ADDRESS=0x...');
