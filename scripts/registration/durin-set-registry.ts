/**
 * Bypass durin.dev's UI: call `setL2Registry` directly on Durin's L1 resolver.
 *
 *   pnpm durin:set-registry
 *
 * Verified ABI (from namestonehq/durin/src/L1Resolver.sol):
 *   function setL2Registry(bytes32 node, uint64 targetChainId, address targetRegistryAddress) external
 *   reverts with Unauthorized() if msg.sender != ens.owner(node) (or NameWrapper holder if wrapped)
 */
import 'dotenv/config';
import { ethers } from 'ethers';
import kleur from 'kleur';

const DURIN_L1_RESOLVER = '0x8A968aB9eb8C084FBC44c531058Fc9ef945c3D61';
const SEPOLIA_ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';

const L1_RESOLVER_ABI = [
  'function setL2Registry(bytes32 node, uint64 targetChainId, address targetRegistryAddress) external',
  'function l2Registry(bytes32 node) view returns (uint64 chainId, address registry)',
];

const ENS_REGISTRY_ABI = [
  'function owner(bytes32 node) view returns (address)',
];

async function main() {
  const parentName = process.env.ENS_PARENT_NAME ?? 'aaether.eth';
  const l2Registry = process.env.DURIN_L2_REGISTRY ?? '0x46f0058d5187b39c5cbdfa325637479bbfbf8a65';
  const l2ChainId = Number(process.env.DURIN_L2_CHAIN_ID ?? '84532');

  if (!process.env.SEPOLIA_PRIVATE_KEY) throw new Error('SEPOLIA_PRIVATE_KEY missing in .env');

  const provider = new ethers.JsonRpcProvider(
    process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia.publicnode.com',
  );
  const wallet = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);

  const node = ethers.namehash(parentName);
  console.log(kleur.cyan('=== Durin setL2Registry (bypass UI) ==='));
  console.log(`Signer:       ${wallet.address}`);
  console.log(`ENS name:     ${parentName}`);
  console.log(`namehash:     ${node}`);
  console.log(`L2 registry:  ${l2Registry}`);
  console.log(`L2 chainId:   ${l2ChainId}`);
  console.log(`L1 resolver:  ${DURIN_L1_RESOLVER}`);

  // Pre-check: ownership
  const ens = new ethers.Contract(SEPOLIA_ENS_REGISTRY, ENS_REGISTRY_ABI, provider);
  const owner: string = await ens.owner(node);
  console.log(`ens.owner(${parentName}): ${owner}`);

  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(kleur.red(`\nUnauthorized: signer ${wallet.address} is not the ENS owner.`));
    console.error(kleur.yellow(
      'Cause: your name is likely wrapped in the NameWrapper. Either:' +
      '\n  - Unwrap from app.ens.domains → More → Name Wrapper → Unwrap,' +
      '\n  - Or use the address that holds the wrapped NFT.',
    ));
    process.exit(1);
  }

  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance:      ${ethers.formatEther(balance)} ETH`);
  if (balance < ethers.parseEther('0.001')) {
    throw new Error('Sepolia balance too low — get more from sepoliafaucet.com');
  }

  // Pre-check: is registry already set?
  const resolver = new ethers.Contract(DURIN_L1_RESOLVER, L1_RESOLVER_ABI, wallet);
  try {
    const current: { chainId: bigint; registry: string } = await resolver.l2Registry(node);
    if (current.registry && current.registry !== ethers.ZeroAddress) {
      console.log(kleur.yellow(
        `\nNOTE: registry already set to ${current.registry} on chain ${current.chainId}. Overwriting.`,
      ));
    }
  } catch {
    // l2Registry getter may have a different signature on some Durin builds; ignore.
  }

  console.log(kleur.cyan('\nCalling setL2Registry...'));
  const tx = await resolver.setL2Registry(node, l2ChainId, l2Registry);
  console.log(kleur.gray(`tx: https://sepolia.etherscan.io/tx/${tx.hash}`));
  const receipt = await tx.wait();
  if (receipt?.status !== 1) {
    throw new Error(`Transaction reverted in block ${receipt?.blockNumber}`);
  }
  console.log(kleur.green(`\n✓ Confirmed in block ${receipt.blockNumber}`));

  // Re-verify
  try {
    const updated: { chainId: bigint; registry: string } = await resolver.l2Registry(node);
    console.log(kleur.gray(`Verified: l2Registry[${parentName}] = (chainId=${updated.chainId}, registry=${updated.registry})`));
  } catch {
    console.log(kleur.gray('(skipping verify; getter signature may differ)'));
  }

  console.log(kleur.green(`\nNext: deploy a Registrar contract on Base Sepolia to mint subnames.`));
  console.log(kleur.gray('  Either via durin.dev step 3, or via this repo\'s contracts/scripts.'));
}

main().catch((e) => {
  console.error(kleur.red(`fatal: ${e?.shortMessage ?? e?.message ?? e}`));
  process.exit(1);
});
