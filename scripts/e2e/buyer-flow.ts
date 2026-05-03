/**
 * Real end-to-end buyer flow:
 *   1. GET /report/:tokenId  → expect HTTP 402 with PAYMENT-REQUIRED
 *   2. parse challenge, sign EIP-3009 transferWithAuthorization (real EIP-712)
 *   3. re-fetch with PAYMENT-SIGNATURE header
 *   4. server: validates signature shape + calls authorizeUsage(tokenId, buyer)
 *      via KeeperHub MCP Guard wrapper
 *   5. server returns the report
 */
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';
dotenvConfig({ path: resolve(import.meta.dirname, '..', '..', '.env') });

import { createWalletClient, http } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { fetchWithPayment, parseChallenge } from '@aether/payments';

const SERVER = process.env.THORNBURY_URL ?? 'http://localhost:3000';
const TOKEN_ID = process.env.AETHER_TOKEN_ID ?? '0';
const USDC_BASE_SEPOLIA = process.env.X402_USDC_BASE_SEPOLIA ?? '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

async function main() {
  console.log('=== Buyer flow ===');
  console.log(`Server:  ${SERVER}`);
  console.log(`Token:   #${TOKEN_ID}`);
  console.log(`Asset:   USDC on Base Sepolia (${USDC_BASE_SEPOLIA})`);

  // Use a fresh buyer wallet (would normally be the user's wallet)
  const buyerKey = process.env.SEPOLIA_PRIVATE_KEY ?? generatePrivateKey();
  const account = privateKeyToAccount(buyerKey as `0x${string}`);
  const wallet = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  });

  console.log(`Buyer:   ${account.address}`);

  // Step 1: First fetch (will get 402)
  console.log('\n[1] GET /report/:id (no PAYMENT-SIGNATURE)...');
  const r1 = await fetch(`${SERVER}/report/${TOKEN_ID}`);
  console.log(`    status: ${r1.status}`);
  if (r1.status !== 402) {
    console.error('    expected 402, got', r1.status, await r1.text());
    process.exit(1);
  }
  const challengeHeader = r1.headers.get('PAYMENT-REQUIRED');
  if (!challengeHeader) {
    console.error('    no PAYMENT-REQUIRED header');
    process.exit(1);
  }
  const challenge = parseChallenge(challengeHeader);
  console.log(`    PAYMENT-REQUIRED parsed: ${challenge.accepts.length} acceptable scheme(s)`);
  console.log(`      scheme:  ${challenge.accepts[0]!.scheme}`);
  console.log(`      network: ${challenge.accepts[0]!.network}`);
  console.log(`      amount:  ${challenge.accepts[0]!.maxAmountRequired} (${challenge.accepts[0]!.asset})`);
  console.log(`      payTo:   ${challenge.accepts[0]!.payTo}`);

  // Step 2-3: fetchWithPayment handles sign + retry
  console.log('\n[2-3] Signing EIP-3009 + retrying...');
  const r2 = await fetchWithPayment(`${SERVER}/report/${TOKEN_ID}`, {
    sourceToken: { address: USDC_BASE_SEPOLIA, chainId: 84532 },
    buyerWallet: wallet,
    buyerAddress: account.address,
  });
  console.log(`    status: ${r2.status}`);
  if (!r2.ok) {
    console.error('    body:', await r2.text());
    process.exit(1);
  }

  const body = await r2.json();
  console.log(`\n[4] Server returned report (${(body.report as string).length} chars)`);
  console.log(`    auditId: ${body.auditId ?? '(no Guard / no KeeperHub call yet)'}`);
  const paymentResp = r2.headers.get('PAYMENT-RESPONSE');
  if (paymentResp) {
    const decoded = JSON.parse(Buffer.from(paymentResp, 'base64').toString());
    console.log(`    PAYMENT-RESPONSE: ${JSON.stringify(decoded).slice(0, 100)}...`);
  }

  console.log('\n[5] Report preview:\n');
  console.log((body.report as string).slice(0, 300) + '...');

  console.log('\n✓ Buyer flow complete.');
  console.log('  - Real EIP-712 TransferWithAuthorization signed by buyer');
  console.log('  - Server received + processed PAYMENT-SIGNATURE');
  if (body.auditId) {
    console.log(`  - KeeperHub Guard executed authorizeUsage tx (audit ${body.auditId})`);
  }
  console.log('');
}

main().catch((e) => {
  console.error('FAILED:', e?.message ?? e);
  process.exit(1);
});
