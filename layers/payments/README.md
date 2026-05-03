# @aether/payments

x402 + Uniswap pay-with-any-token integration.

## Server side

```ts
import { x402Challenge } from '@aether/payments';

app.get('/report/:id', async (req, res) => {
  if (!req.header('PAYMENT-SIGNATURE')) {
    const { header, status } = x402Challenge([{
      scheme: 'exact',
      network: 'base-sepolia',
      maxAmountRequired: '500000',
      asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      payTo: '0xYOUR_AGENT_WALLET',
      description: 'Thornbury report',
    }]);
    return res.status(status).setHeader('PAYMENT-REQUIRED', header).json({ error: 'Payment required' });
  }
  // ... process payment, serve resource
});
```

## Buyer side

```ts
import { payWithAnyToken, parseChallenge } from '@aether/payments';

const r1 = await fetch(reportUrl);
if (r1.status === 402) {
  const challenge = parseChallenge(r1.headers.get('PAYMENT-REQUIRED')!);
  const { paymentSignature } = await payWithAnyToken({
    challenge,
    sourceToken: { address: DAI, chainId: 1 },
    buyerWallet: wallet,
  });
  const r2 = await fetch(reportUrl, { headers: { 'PAYMENT-SIGNATURE': paymentSignature }});
}
```

## Submission target

**Uniswap Best API** ($5,000 opportunistic). Server-side x402 envelope is the missing counterpart to Uniswap's client-only pay-with-any-token plugin.
