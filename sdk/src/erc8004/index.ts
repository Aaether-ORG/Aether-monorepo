/**
 * ERC-8004 Trustless Agents client.
 *
 * Live Sepolia deployments (verified 2026-04-28):
 *   IdentityRegistry:   0x8004A818BFB912233c491871b3d84c89A494BD9e
 *   ReputationRegistry: 0x8004B663056A597Dffe9eCcC1965A193B7388713
 */
import { ethers } from 'ethers';

export const SEPOLIA_IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e';
export const SEPOLIA_REPUTATION_REGISTRY = '0x8004B663056A597Dffe9eCcC1965A193B7388713';

const IDENTITY_ABI = [
  'function register(string agentURI) external returns (uint256 agentId)',
  'function setAgentURI(uint256 agentId, string newURI) external',
  'function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes signature) external',
  'function getAgentWallet(uint256 agentId) external view returns (address)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'event Registered(uint256 indexed agentId, address indexed owner, string agentURI)',
];

const REPUTATION_ABI = [
  'function giveFeedback(string agentRegistry, uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string feedbackURI, bytes32 feedbackHash) external',
  'function getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)',
];

export interface AgentCard {
  type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1';
  name: string;
  description: string;
  image?: string;
  services: AgentService[];
  x402Support: boolean;
  active: boolean;
  registrations: { agentId: number; agentRegistry: string }[];
  supportedTrust: ('reputation' | 'crypto-economic' | 'tee-attestation')[];
}

export interface AgentService {
  name: 'web' | 'A2A' | 'MCP' | 'OASF' | 'ENS' | 'DID' | 'email';
  endpoint: string;
  version?: string;
}

/**
 * Register an agent in the ERC-8004 IdentityRegistry.
 * `agentURI` should be an `ipfs://...` or `https://...` URL pointing to the
 * agent card JSON (see {@link AgentCard}).
 */
export async function registerAgent(
  wallet: ethers.Wallet,
  agentURI: string,
  registryAddress: string = SEPOLIA_IDENTITY_REGISTRY,
): Promise<{ agentId: bigint; txHash: string }> {
  const c = new ethers.Contract(registryAddress, IDENTITY_ABI, wallet);
  const tx = await (c as any).register(agentURI);
  const receipt = await tx.wait();
  const reg = receipt.logs
    .map((l: any) => { try { return c.interface.parseLog(l); } catch { return null; } })
    .find((p: any) => p?.name === 'Registered');
  if (!reg) throw new Error('Registered event not found');
  return { agentId: reg.args.agentId as bigint, txHash: receipt.hash };
}

/** Submit feedback for an agent (high score = good). */
export async function giveFeedback(
  wallet: ethers.Wallet,
  args: {
    agentId: bigint;
    value: number;
    valueDecimals?: number;
    tag1?: string;
    tag2?: string;
    feedbackURI?: string;
    feedbackHash?: string;
    registryAddress?: string;
    reputationAddress?: string;
  },
): Promise<string> {
  const reg = args.registryAddress ?? SEPOLIA_IDENTITY_REGISTRY;
  const rep = args.reputationAddress ?? SEPOLIA_REPUTATION_REGISTRY;
  const c = new ethers.Contract(rep, REPUTATION_ABI, wallet);

  const network = await wallet.provider!.getNetwork();
  const agentRegistryStr = `eip155:${network.chainId}:${reg}`;

  const tx = await (c as any).giveFeedback(
    agentRegistryStr,
    args.agentId,
    args.value,
    args.valueDecimals ?? 0,
    args.tag1 ?? '',
    args.tag2 ?? '',
    args.feedbackURI ?? '',
    args.feedbackHash ?? ethers.ZeroHash,
  );
  const receipt = await tx.wait();
  return receipt.hash;
}

/** Build a default agent card. */
export function buildAgentCard(args: {
  name: string;
  description: string;
  image?: string;
  ensName?: string;
  webEndpoint?: string;
  mcpEndpoint?: string;
  a2aEndpoint?: string;
  x402Endpoint?: string;
}): AgentCard {
  const services: AgentService[] = [];
  if (args.webEndpoint) services.push({ name: 'web', endpoint: args.webEndpoint });
  if (args.a2aEndpoint) services.push({ name: 'A2A', endpoint: args.a2aEndpoint, version: '0.3.0' });
  if (args.mcpEndpoint) services.push({ name: 'MCP', endpoint: args.mcpEndpoint, version: '2025-06-18' });
  if (args.ensName) services.push({ name: 'ENS', endpoint: args.ensName, version: 'v1' });

  return {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: args.name,
    description: args.description,
    image: args.image,
    services,
    x402Support: !!args.x402Endpoint,
    active: true,
    registrations: [],
    supportedTrust: ['reputation', 'tee-attestation'],
  };
}
