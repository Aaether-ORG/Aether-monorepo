/**
 * Register the Thornbury agent in ERC-8004's IdentityRegistry on Sepolia.
 *
 * Flow:
 *   1. Build the agent card JSON (per ERC-8004 registration-v1 schema)
 *   2. Pin to IPFS via web3.storage / pinata (need WEB3_STORAGE_TOKEN or PINATA_JWT)
 *   3. Call IdentityRegistry.register(agentURI) on Sepolia
 *   4. Capture agentId; print + write to deployments/sepolia.erc8004.json
 *
 *   pnpm tsx scripts/registration/register-erc8004.ts
 */
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';
dotenvConfig({ path: resolve(import.meta.dirname, '..', '..', '.env') });

import { ethers } from 'ethers';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import kleur from 'kleur';

const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia.publicnode.com';
const IDENTITY_REGISTRY = process.env.ERC8004_IDENTITY ?? '0x8004A818BFB912233c491871b3d84c89A494BD9e';

const IDENTITY_ABI = [
  'function register(string agentURI) external returns (uint256 agentId)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'event Registered(uint256 indexed agentId, address indexed owner, string agentURI)',
];

interface AgentCard {
  type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1';
  name: string;
  description: string;
  image?: string;
  services: { name: string; endpoint: string; version?: string }[];
  x402Support: boolean;
  active: boolean;
  registrations: { agentId: number; agentRegistry: string }[];
  supportedTrust: string[];
}

function buildAgentCard(): AgentCard {
  const baseUrl = process.env.THORNBURY_PUBLIC_URL ?? 'http://localhost:3000';
  return {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: process.env.AGENT_NAME ?? 'Thornbury',
    description: 'Self-financing research agent on 0G — replayable via Aether',
    image: process.env.AGENT_IMAGE_URL ?? `${baseUrl}/avatar.svg`,
    services: [
      { name: 'web', endpoint: `${baseUrl}/` },
      { name: 'A2A', endpoint: `${baseUrl}/.well-known/agent-card.json`, version: '0.3.0' },
      { name: 'MCP', endpoint: `${baseUrl}/mcp`, version: '2025-06-18' },
      ...(process.env.ENS_NAME ? [{ name: 'ENS', endpoint: process.env.ENS_NAME, version: 'v1' }] : []),
    ],
    x402Support: true,
    active: true,
    registrations: [],
    supportedTrust: ['reputation', 'tee-attestation'],
  };
}

async function pinToIpfs(card: AgentCard): Promise<string> {
  // Prefer pinata; fall back to web3.storage; fall back to data URI.
  const json = JSON.stringify(card, null, 2);

  if (process.env.PINATA_JWT) {
    console.log(kleur.gray('Pinning via Pinata...'));
    const r = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.PINATA_JWT}`,
      },
      body: JSON.stringify({
        pinataContent: card,
        pinataMetadata: { name: `aether-agent-${card.name}` },
      }),
    });
    if (!r.ok) throw new Error(`Pinata pin failed: ${r.status} ${await r.text()}`);
    const j = await r.json() as any;
    return `ipfs://${j.IpfsHash}`;
  }

  if (process.env.WEB3_STORAGE_TOKEN) {
    console.log(kleur.gray('Pinning via web3.storage...'));
    const blob = new Blob([json], { type: 'application/json' });
    const file = new File([blob], 'agent.json');
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch('https://api.web3.storage/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WEB3_STORAGE_TOKEN}` },
      body: fd,
    });
    if (!r.ok) throw new Error(`web3.storage upload failed: ${r.status}`);
    const j = await r.json() as any;
    return `ipfs://${j.cid}`;
  }

  // Fallback: data URI (works for the spec but not browser-resolvable widely)
  console.log(kleur.yellow('No pinning service configured — using base64 data URI.'));
  console.log(kleur.yellow('Set PINATA_JWT or WEB3_STORAGE_TOKEN in .env for IPFS pinning.'));
  const b64 = Buffer.from(json).toString('base64');
  return `data:application/json;base64,${b64}`;
}

async function main() {
  console.log(kleur.cyan('=== ERC-8004 registration on Sepolia ==='));

  if (!process.env.SEPOLIA_PRIVATE_KEY) {
    throw new Error('SEPOLIA_PRIVATE_KEY not set in .env');
  }

  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const wallet = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);

  console.log(`Signer:           ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance:          ${ethers.formatEther(balance)} ETH`);
  if (balance < ethers.parseEther('0.005')) {
    console.log(kleur.yellow('⚠  Low Sepolia ETH balance. Get more from sepoliafaucet.com'));
  }

  console.log(`IdentityRegistry: ${IDENTITY_REGISTRY}`);

  // 1. Build card
  const card = buildAgentCard();
  console.log(kleur.gray('\nAgent card:'));
  console.log(JSON.stringify(card, null, 2));

  // 2. Pin to IPFS
  const agentURI = await pinToIpfs(card);
  console.log(kleur.green(`agentURI: ${agentURI}`));

  // 3. Register on chain
  console.log(kleur.cyan('\nCalling IdentityRegistry.register()...'));
  const c = new ethers.Contract(IDENTITY_REGISTRY, IDENTITY_ABI, wallet);
  const tx = await c.register(agentURI);
  console.log(kleur.gray(`tx: https://sepolia.etherscan.io/tx/${tx.hash}`));
  const receipt = await tx.wait();

  // Parse Registered event
  const reg = receipt.logs
    .map((l: any) => { try { return c.interface.parseLog(l); } catch { return null; } })
    .find((p: any) => p?.name === 'Registered');

  if (!reg) {
    throw new Error('Registered event not found in receipt');
  }

  const agentId = reg.args.agentId as bigint;
  console.log(kleur.green(`\n✓ Registered agentId: ${agentId}`));
  console.log(kleur.gray(`  ENSIP-25 binding text record key:`));
  console.log(kleur.gray(`  agent-registration[${IDENTITY_REGISTRY}][${agentId}]`));
  console.log(kleur.gray(`  Set the value to "1" on your ENS subname.`));

  // Save
  const out = {
    chainId: 11155111,
    network: 'sepolia',
    agentId: agentId.toString(),
    agentURI,
    txHash: tx.hash,
    owner: wallet.address,
    timestamp: new Date().toISOString(),
  };
  const dir = join(process.cwd(), 'deployments');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'sepolia.erc8004.json'), JSON.stringify(out, null, 2));
  console.log(kleur.gray(`Saved deployments/sepolia.erc8004.json`));

  console.log(kleur.cyan('\nNext steps:'));
  console.log(`  1. Add to .env:  ERC8004_AGENT_ID=${agentId}`);
  console.log(`  2. Set ENS text record on your subname (via Durin or directly):`);
  console.log(`       key:   agent-registration[${IDENTITY_REGISTRY}][${agentId}]`);
  console.log(`       value: 1`);
}

main().catch((e) => {
  console.error(kleur.red(`\nFAILED: ${e?.message ?? e}`));
  process.exit(1);
});
