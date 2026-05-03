/** Display helpers. */

export function shorten(hex: string, head = 6, tail = 4): string {
  if (!hex) return '';
  if (hex.length <= head + tail + 2) return hex;
  return `${hex.slice(0, 2 + head)}…${hex.slice(-tail)}`;
}

/**
 * Build a block-explorer URL for a tx or address on a given chain.
 * Returns null if the chain isn't recognized.
 */
export function explorerUrl(
  chainId: number | string,
  hash: string,
  kind: 'tx' | 'address' | 'token' = 'tx',
): string | null {
  const id = typeof chainId === 'string' ? Number(chainId) : chainId;
  const base = (() => {
    switch (id) {
      case 16602:    return 'https://chainscan-galileo.0g.ai';
      case 11155111: return 'https://sepolia.etherscan.io';
      case 84532:    return 'https://sepolia.basescan.org';
      case 1:        return 'https://etherscan.io';
      case 8453:     return 'https://basescan.org';
      case 137:      return 'https://polygonscan.com';
      case 42161:    return 'https://arbiscan.io';
      default: return null;
    }
  })();
  if (!base || !hash) return null;
  return `${base}/${kind}/${hash}`;
}

export const explorerName = (chainId: number | string): string => {
  const id = typeof chainId === 'string' ? Number(chainId) : chainId;
  switch (id) {
    case 16602:    return 'chainscan-galileo';
    case 11155111: return 'sepolia.etherscan';
    case 84532:    return 'sepolia.basescan';
    case 1:        return 'etherscan';
    case 8453:     return 'basescan';
    default:       return `chain-${id}`;
  }
};

export function formatTs(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatRelative(ts: number, now = Date.now()): string {
  const dt = (ts - now) / 1000;
  const abs = Math.abs(dt);
  if (abs < 60) return `${Math.round(abs)}s ago`;
  if (abs < 3600) return `${Math.round(abs / 60)}m ago`;
  return `${Math.round(abs / 3600)}h ago`;
}
