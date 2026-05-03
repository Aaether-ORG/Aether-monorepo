/**
 * ENS text record schema for Aether agents.
 *
 * Combines ENSIP-25 binding (`agent-registration[<registry>][<agentId>]`)
 * with Aether's runtime keys (model version, latest event hash, uptime).
 */

export interface AmmoniteRecords {
  // ENSIP-25 binding (mandatory for ERC-8004 verification)
  /** key: agent-registration[<registry>][<agentId>] → "1" */
  ensip25Binding: { registry: string; agentId: bigint; value: string };

  // ERC-8004 reference
  agentErc8004Id: string;          // e.g. "eip155:11155111:0x8004A8..:tokenId=42"

  // Aether-specific
  agentAetherInft: string;          // e.g. "eip155:16601:0xAGENT_NFT:tokenId=7"
  agentAetherHead: string;          // latest event hash (live)
  agentModelVersion: string;        // e.g. "glm-5-fp8@2026.04"
  agentUptimeLast24h: string;       // computed at gateway

  // Service endpoints
  agentServicesMcp?: string;
  agentServicesA2a?: string;
  agentServicesX402?: string;
  agentServicesWeb?: string;

  // Standard ENS metadata
  avatar?: string;
  description?: string;
  url?: string;
}

export function ensip25Key(registry: string, agentId: bigint): string {
  return `agent-registration[${registry}][${agentId}]`;
}

/** All keys this resolver dynamically computes (others are static). */
export const DYNAMIC_KEYS = new Set([
  'agent.aether.head',
  'agent.uptime.last24h',
  'agent.model.version',
]);

export function isDynamicKey(k: string): boolean {
  return DYNAMIC_KEYS.has(k);
}
