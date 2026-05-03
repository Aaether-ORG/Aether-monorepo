/**
 * x402 challenge envelope helpers.
 *
 * The x402 spec encodes payment requirements as base64-JSON in the
 * PAYMENT-REQUIRED HTTP header.
 */
export interface X402Accepts {
  scheme: 'exact';
  network: string;            // CAIP-2 or named ('base-sepolia', 'eip155:8453', etc.)
  maxAmountRequired: string;  // smallest-unit string (e.g. "500000" for 0.50 USDC 6dec)
  asset: string;              // ERC-20 contract address
  payTo: string;
  description: string;
  /** Optional asset metadata for buyer-side EIP-712 signing (per x402 spec). */
  extra?: {
    assetTransferMethod?: 'eip3009' | 'permit2' | 'erc7710';
    /** EIP-712 domain.name for the asset contract (e.g. "USD Coin", "ZG-USD"). */
    name?: string;
    /** EIP-712 domain.version (e.g. "2"). */
    version?: string;
    /** Token decimals for human-readable display. */
    decimals?: number;
  };
}

export interface X402Challenge {
  version: 1;
  accepts: X402Accepts[];
}

export function x402Challenge(accepts: X402Accepts[]): { header: string; status: 402 } {
  const challenge: X402Challenge = { version: 1, accepts };
  const header = Buffer.from(JSON.stringify(challenge)).toString('base64');
  return { header, status: 402 };
}

export function parseChallenge(header: string): X402Challenge {
  return JSON.parse(Buffer.from(header, 'base64').toString());
}
