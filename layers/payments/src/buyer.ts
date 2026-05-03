/**
 * Buyer-side x402 payment helper.
 *
 * Implements the EIP-3009 path of the x402 spec
 *   ( https://github.com/coinbase/x402/blob/main/specs/schemes/exact/scheme_exact_evm.md )
 *
 * This is the real production path for paying x402 endpoints denominated in
 * USDC, EURC, or any other EIP-3009-compliant token. The buyer signs an
 * off-chain `TransferWithAuthorization` typed-data message; the facilitator
 * submits it on-chain via `transferWithAuthorization()` at settlement time.
 *
 * Cross-token (e.g. buyer holds DAI, server wants USDC) requires a swap step
 * via Uniswap Universal Router + Permit2 *before* the EIP-3009 payment. We
 * sketch this path; production uses the Uniswap `pay-with-any-token` Claude
 * skill or replicates its calldata directly.
 */
import {
  type WalletClient,
  type Hex,
  hexToBytes,
  bytesToHex,
  parseUnits,
  zeroAddress,
} from 'viem';
import type { X402Challenge, X402Accepts } from './x402.js';
import { randomBytes } from 'node:crypto';

export interface PayWithAnyTokenArgs {
  challenge: X402Challenge;
  /** Token the buyer holds. Optional — same-token path if undefined or matches the asset. */
  sourceToken?: { address: string; chainId: number };
  /** Buyer's wallet client. Must support EIP-712 signing. */
  buyerWallet: WalletClient;
  /** Buyer's address. Defaults to wallet account. */
  buyerAddress?: Hex;
  /** Resource URL the buyer is fetching (for the EIP-712 resource field). */
  resourceUrl?: string;
  /** EIP-712 domain.name override (defaults to 'USD Coin' for USDC). */
  assetDomainName?: string;
  /** EIP-712 domain.version override (defaults to '2' for USDC). */
  assetDomainVersion?: string;
}

export interface PayResult {
  /** base64 PAYMENT-SIGNATURE header value (the full PaymentPayload). */
  paymentSignature: string;
  /** The raw signature in 0x-hex form. */
  signature: Hex;
  /** The EIP-3009 authorization fields (for debugging/display). */
  authorization: Eip3009Authorization;
  /** Path used. */
  path: 'eip3009' | 'eip3009-after-swap';
  /** Optional swap tx if we did Uniswap swap first. */
  swapTxHash?: Hex;
}

export interface Eip3009Authorization {
  from: Hex;
  to: Hex;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: Hex;
}

/**
 * Pay an x402 challenge using EIP-3009 transferWithAuthorization.
 *
 * For same-token (buyer's source matches `accepted.asset`): we sign directly.
 * For cross-token: the production path swaps via Uniswap first; in this
 * implementation we throw and direct callers to use the Uniswap skill or
 * repeat the call after manually swapping.
 */
export async function payWithAnyToken(args: PayWithAnyTokenArgs): Promise<PayResult> {
  const target = args.challenge.accepts[0];
  if (!target) throw new Error('No acceptable schemes in x402 challenge');
  if (target.scheme !== 'exact') {
    throw new Error(`Unsupported x402 scheme: ${target.scheme}`);
  }

  const buyer = (args.buyerAddress ??
    args.buyerWallet.account?.address ??
    (() => { throw new Error('buyer address required'); })()) as Hex;

  const sameToken =
    !args.sourceToken ||
    args.sourceToken.address.toLowerCase() === target.asset.toLowerCase();

  if (!sameToken) {
    // Production path: swap via Uniswap Universal Router, then sign EIP-3009
    // on the resulting USDC. We surface a clear error because the swap step
    // requires either:
    //   1. Calling the Uniswap pay-with-any-token Claude skill, or
    //   2. Constructing Universal Router calldata directly (commands + inputs)
    //
    // The Aether SDK could grow this in v0.2.
    throw new CrossTokenNotImplementedError(args.sourceToken!, target);
  }

  // === Same-token path: sign EIP-3009 transferWithAuthorization ===

  const chainId = parseChainId(target.network);

  const now = Math.floor(Date.now() / 1000);
  const auth: Eip3009Authorization = {
    from: buyer,
    to: target.payTo as Hex,
    value: target.maxAmountRequired,
    validAfter: String(now - 60),                                     // 1 minute clock skew tolerance
    validBefore: String(now + ((target as any).maxTimeoutSeconds ?? 600)), // 10 minutes default
    nonce: bytesToHex(randomBytes(32)) as Hex,
  };

  const domain = {
    name: args.assetDomainName ?? 'USD Coin',
    version: args.assetDomainVersion ?? '2',
    chainId,
    verifyingContract: target.asset as Hex,
  };

  const types = {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
  } as const;

  const message = {
    from: auth.from,
    to: auth.to,
    value: BigInt(auth.value),
    validAfter: BigInt(auth.validAfter),
    validBefore: BigInt(auth.validBefore),
    nonce: auth.nonce,
  };

  const signature = await args.buyerWallet.signTypedData({
    account: args.buyerWallet.account!,
    domain,
    types,
    primaryType: 'TransferWithAuthorization',
    message,
  });

  // Build the PaymentPayload per x402 EVM spec.
  const paymentPayload = {
    x402Version: 2,
    resource: args.resourceUrl ? {
      url: args.resourceUrl,
      description: target.description,
      mimeType: 'application/json',
    } : undefined,
    accepted: {
      scheme: target.scheme,
      network: target.network,
      amount: target.maxAmountRequired,
      asset: target.asset,
      payTo: target.payTo,
      maxTimeoutSeconds: 600,
      extra: {
        assetTransferMethod: 'eip3009',
        name: domain.name,
        version: domain.version,
      },
    },
    payload: {
      signature,
      authorization: auth,
    },
  };

  const headerValue = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');

  return {
    paymentSignature: headerValue,
    signature,
    authorization: auth,
    path: 'eip3009',
  };
}

/**
 * Convenience: fetch a paywalled URL and pay if needed.
 */
export async function fetchWithPayment(
  url: string,
  args: Omit<PayWithAnyTokenArgs, 'challenge' | 'resourceUrl'>,
  fetchOpts: RequestInit = {},
): Promise<Response> {
  const r1 = await fetch(url, fetchOpts);
  if (r1.status !== 402) return r1;

  const challengeHeader = r1.headers.get('PAYMENT-REQUIRED');
  if (!challengeHeader) throw new Error('402 received but no PAYMENT-REQUIRED header');
  const challenge: X402Challenge = JSON.parse(Buffer.from(challengeHeader, 'base64').toString());

  const { paymentSignature } = await payWithAnyToken({
    ...args,
    challenge,
    resourceUrl: url,
  });

  return await fetch(url, {
    ...fetchOpts,
    headers: {
      ...(fetchOpts.headers ?? {}),
      'PAYMENT-SIGNATURE': paymentSignature,
      'X-Buyer-Address': args.buyerAddress ?? args.buyerWallet.account?.address ?? '',
    },
  });
}

/** Parse a CAIP-2, named network, or bare-numeric chain id into a number. */
function parseChainId(network: string): number {
  // Bare numeric chain id, e.g. "16602"
  if (/^\d+$/.test(network)) return Number(network);
  // CAIP-2 form, e.g. "eip155:16602"
  if (network.startsWith('eip155:')) return Number(network.slice(7));
  // Common named networks
  const named: Record<string, number> = {
    'base':              8453,
    'base-sepolia':      84532,
    'ethereum':          1,
    'sepolia':           11155111,
    'polygon':           137,
    'polygon-amoy':      80002,
    'arbitrum':          42161,
    'arbitrum-sepolia':  421614,
    'optimism':          10,
    'optimism-sepolia':  11155420,
    '0g':                16602,
    '0g-galileo':        16602,
    'galileo':           16602,
  };
  if (named[network] === undefined) throw new Error(`Unknown network: ${network}`);
  return named[network]!;
}

export class CrossTokenNotImplementedError extends Error {
  constructor(
    public sourceToken: { address: string; chainId: number },
    public targetAccept: X402Accepts,
  ) {
    super(
      `Cross-token x402 payment not implemented in @aether/payments. ` +
      `Buyer holds ${sourceToken.address} on chain ${sourceToken.chainId}; ` +
      `server wants ${targetAccept.asset} on ${targetAccept.network}. ` +
      `Use the Uniswap pay-with-any-token Claude skill: ` +
      `npx skills add Uniswap/uniswap-ai --skill pay-with-any-token  ` +
      `then re-issue the request with the same target token.`,
    );
    this.name = 'CrossTokenNotImplementedError';
  }
}
