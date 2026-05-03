import { describe, it, expect } from 'vitest';
import { createWalletClient, http, privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { generatePrivateKey } from 'viem/accounts';
import { x402Challenge, parseChallenge } from '../src/x402.js';
import { payWithAnyToken, CrossTokenNotImplementedError } from '../src/buyer.js';
import { createWalletClient as createWC } from 'viem';

describe('x402 challenge envelope', () => {
  it('roundtrips header → parse', () => {
    const { header, status } = x402Challenge([{
      scheme: 'exact',
      network: 'base-sepolia',
      maxAmountRequired: '500000',
      asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      payTo: '0x0000000000000000000000000000000000000001',
      description: 'test',
    }]);
    expect(status).toBe(402);
    const parsed = parseChallenge(header);
    expect(parsed.version).toBe(1);
    expect(parsed.accepts[0]!.network).toBe('base-sepolia');
  });
});

describe('payWithAnyToken (EIP-3009 same-token path)', () => {
  it('signs a valid EIP-712 TransferWithAuthorization', async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const wallet = createWC({
      account,
      chain: baseSepolia,
      transport: http(),
    });

    const challenge = parseChallenge(x402Challenge([{
      scheme: 'exact',
      network: 'base-sepolia',
      maxAmountRequired: '500000',
      asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC Base Sepolia
      payTo: '0x0000000000000000000000000000000000000001',
      description: 'test',
    }]).header);

    const r = await payWithAnyToken({
      challenge,
      sourceToken: { address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', chainId: 84532 },
      buyerWallet: wallet,
      resourceUrl: 'https://example.com/report/1',
    });

    expect(r.path).toBe('eip3009');
    expect(r.signature.length).toBe(132); // 0x + 130 hex
    expect(r.authorization.from.toLowerCase()).toBe(account.address.toLowerCase());
    expect(r.authorization.value).toBe('500000');

    // Decode the base64 PAYMENT-SIGNATURE and verify schema
    const decoded = JSON.parse(Buffer.from(r.paymentSignature, 'base64').toString());
    expect(decoded.x402Version).toBe(2);
    expect(decoded.accepted.scheme).toBe('exact');
    expect(decoded.accepted.extra.assetTransferMethod).toBe('eip3009');
    expect(decoded.payload.signature).toBe(r.signature);
    expect(decoded.payload.authorization.from.toLowerCase()).toBe(account.address.toLowerCase());
  });

  it('throws CrossTokenNotImplementedError for cross-token', async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const wallet = createWC({
      account,
      chain: baseSepolia,
      transport: http(),
    });

    const challenge = parseChallenge(x402Challenge([{
      scheme: 'exact',
      network: 'base-sepolia',
      maxAmountRequired: '100',
      asset: '0xUSDC0000000000000000000000000000000000000',
      payTo: '0xRecv00000000000000000000000000000000000000',
      description: 't',
    }]).header);

    await expect(payWithAnyToken({
      challenge,
      sourceToken: { address: '0xDAI0000000000000000000000000000000000000', chainId: 11155111 },
      buyerWallet: wallet,
    })).rejects.toThrow(CrossTokenNotImplementedError);
  });
});
