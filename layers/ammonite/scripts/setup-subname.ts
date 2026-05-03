/**
 * Mint an Aether agent subname under your parent ENS name via Durin L2 registry +
 * registrar; then set ENSIP-25 binding + service text records on the L2 Registry
 * (the registry inherits L2Resolver and accepts setText from approved registrars
 * or the registry owner).
 *
 *   pnpm tsx layers/ammonite/scripts/setup-subname.ts thornbury
 */
import 'dotenv/config';
import { ethers } from 'ethers';
import { ensip25Key } from '../src/records.js';

const REGISTRAR_ABI = [
  'function register(string label, address owner) external',
  'function registerWithTexts(string label, address owner, string[] keys, string[] values) external',
  'function available(string label) external view returns (bool)',
];

const REGISTRY_ABI = [
  'function setText(bytes32 node, string key, string value) external',
  'function makeNode(bytes32 parentNode, string label) external pure returns (bytes32)',
  'function baseNode() external view returns (bytes32)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
];

async function main() {
  const label = process.argv[2] ?? 'thornbury';
  const registryAddr = process.env.DURIN_L2_REGISTRY;
  const registrarAddr = process.env.DURIN_L2_REGISTRAR;
  const parentName = process.env.ENS_PARENT_NAME ?? 'aaether.eth';

  if (!registryAddr) throw new Error('DURIN_L2_REGISTRY not set');
  if (!registrarAddr) throw new Error('DURIN_L2_REGISTRAR not set (run pnpm deploy:registrar first)');

  const baseSepolia = new ethers.JsonRpcProvider(
    process.env.BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org',
  );
  const wallet = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY!, baseSepolia);

  console.log(`Minting:    ${label}.${parentName}`);
  console.log(`Owner:      ${wallet.address}`);
  console.log(`Registry:   ${registryAddr}`);
  console.log(`Registrar:  ${registrarAddr}`);

  const registrar = new ethers.Contract(registrarAddr, REGISTRAR_ABI, wallet);
  const registry = new ethers.Contract(registryAddr, REGISTRY_ABI, wallet);

  // Build records
  const erc8004Identity = process.env.ERC8004_IDENTITY ?? '0x8004A818BFB912233c491871b3d84c89A494BD9e';
  const agentId = process.env.ERC8004_AGENT_ID ?? '1';

  const records: [string, string][] = [
    // ENSIP-25 binding (set value to '1' to confirm association with ERC-8004 agent)
    [ensip25Key(erc8004Identity, BigInt(agentId)), '1'],
    // Service endpoints
    ['agent.services.web',  process.env.THORNBURY_PUBLIC_URL ?? `https://${label}.aether.local/`],
    ['agent.services.mcp',  `${process.env.THORNBURY_PUBLIC_URL ?? 'http://localhost:3000'}/mcp`],
    ['agent.services.x402', `${process.env.THORNBURY_PUBLIC_URL ?? 'http://localhost:3000'}/.well-known/x402`],
    // Aether-specific
    ['agent.aether.inft',   `eip155:16601:${process.env.AGENT_NFT_ADDRESS ?? '0x'}:tokenId=${process.env.AETHER_TOKEN_ID ?? '?'}`],
    ['agent.model.version', process.env.ZG_COMPUTE_DEFAULT_MODEL ?? 'glm-5-fp8'],
    // Standard ENS
    ['avatar',              process.env.AGENT_AVATAR_URL ?? `${process.env.THORNBURY_PUBLIC_URL ?? 'http://localhost:3000'}/avatar.svg`],
    ['description',         'Self-financing research agent on 0G — replayable via Aether'],
    ['url',                 process.env.THORNBURY_PUBLIC_URL ?? `https://${label}.aether.local/`],
  ];

  // 1. Check availability
  const isAvail = await (registrar as any).available(label).catch(() => true);
  if (!isAvail) {
    console.log(`Label "${label}" already taken — skipping mint, only setting records.`);
  } else {
    // 2. Mint with text records in one tx (atomic, cheaper)
    console.log('\nMinting + setting records (atomic)...');
    const keys = records.map(([k]) => k);
    const values = records.map(([, v]) => v);
    const tx = await (registrar as any).registerWithTexts(label, wallet.address, keys, values);
    console.log(`  tx: ${tx.hash}`);
    console.log(`  https://sepolia.basescan.org/tx/${tx.hash}`);
    const r = await tx.wait();
    if (r.status !== 1) throw new Error('mint reverted');
    console.log(`  ✓ confirmed in block ${r.blockNumber}`);
  }

  // If label already existed, just refresh records via direct setText
  if (!isAvail) {
    const baseNode = await (registry as any).baseNode();
    const node = await (registry as any).makeNode(baseNode, label);
    console.log('\nSetting text records on existing subname...');
    for (const [k, v] of records) {
      console.log(`  setText  ${k}`);
      try {
        const tx = await (registry as any).setText(node, k, v);
        await tx.wait();
      } catch (e: any) {
        console.log(`    skip (${e?.shortMessage ?? e?.message})`);
      }
    }
  }

  console.log('\n=== DONE ===');
  console.log(`Resolve at: ${label}.${parentName}`);
  console.log('Verify (after a few blocks):');
  console.log(`  cast resolver ${label}.${parentName} --rpc-url ${process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia.publicnode.com'}`);
  console.log(`  Or visit: https://app.ens.domains/${label}.${parentName}?network=sepolia`);
}

main().catch((e) => {
  console.error('FAILED:', e?.shortMessage ?? e?.message ?? e);
  process.exit(1);
});
