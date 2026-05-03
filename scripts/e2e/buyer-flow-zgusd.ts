/**
 * End-to-end buyer flow using ZGUSD on 0G Galileo.
 *
 *   1. GET /report/:id → 402 with PAYMENT-REQUIRED (asset=ZGUSD, network=16602)
 *   2. Buyer signs EIP-712 TransferWithAuthorization over ZGUSD's domain
 *   3. Re-fetch with PAYMENT-SIGNATURE header
 *   4. Server: validates signature on-chain via ZGUSD.transferWithAuthorization →
 *      real ZGUSD moves from buyer to seller
 *   5. Server then calls AgentNFT.authorizeUsage(tokenId, buyer) (KeeperHub or fallback)
 *   6. Server returns the report
 *
 *   pnpm tsx scripts/e2e/buyer-flow-zgusd.ts
 */
import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '..', '..', '.env') });

import { createWalletClient, http, parseChainId } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';
import { fetchWithPayment, parseChallenge } from '@aether/payments';
import { ethers } from 'ethers';

const SERVER = process.env.THORNBURY_URL ?? 'http://localhost:3000';
const TOKEN_ID = process.env.AETHER_TOKEN_ID ?? '1';
const ZGUSD = process.env.ZGUSD_ADDRESS!;

const galileo = defineChain({
  id: 16602,
  name: '0G Galileo',
  nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
  rpcUrls: { default: { http: [process.env.ZG_RPC_URL ?? 'https://evmrpc-testnet.0g.ai'] } },
});

async function main() {
  console.log('=== Buyer flow (ZGUSD on 0G Galileo) ===');
  console.log(`Server:  ${SERVER}`);
  console.log(`Token:   #${TOKEN_ID}`);
  console.log(`ZGUSD:   ${ZGUSD}`);

  // Use the KeeperHub Turnkey wallet as the buyer (it has 1,000 ZGUSD)
  const buyerKey = process.env.KEEPERHUB_WALLET_PRIVATE_KEY!;
  const account = privateKeyToAccount(buyerKey as `0x${string}`);
  const wallet = createWalletClient({ account, chain: galileo, transport: http() });

  console.log(`Buyer:   ${account.address}`);

  // Pre-flight: balances
  const provider = new ethers.JsonRpcProvider(process.env.ZG_RPC_URL!);
  const tok = new ethers.Contract(
    ZGUSD,
    ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
    provider,
  );
  const decimals = Number(await (tok as any).decimals());
  const buyerBalBefore = await (tok as any).balanceOf(account.address);
  const sellerAddr = process.env.AGENT_PAYMENT_ADDRESS!;
  const sellerBalBefore = await (tok as any).balanceOf(sellerAddr);
  console.log(`\nPre-flight balances:`);
  console.log(`  buyer  ZGUSD: ${ethers.formatUnits(buyerBalBefore, decimals)}`);
  console.log(`  seller ZGUSD: ${ethers.formatUnits(sellerBalBefore, decimals)}`);

  // 1. First fetch — expect 402
  console.log('\n[1] GET /report/:id (no PAYMENT-SIGNATURE)...');
  const r1 = await fetch(`${SERVER}/report/${TOKEN_ID}`);
  console.log(`    status: ${r1.status}`);
  const challengeHeader = r1.headers.get('PAYMENT-REQUIRED');
  const challenge = parseChallenge(challengeHeader!);
  console.log(`    challenge: scheme=${challenge.accepts[0]!.scheme} network=${challenge.accepts[0]!.network} amount=${challenge.accepts[0]!.maxAmountRequired} asset=${challenge.accepts[0]!.asset}`);

  // 2-3. Sign + retry. Override the domain to match ZG-USD.
  console.log('\n[2-3] Signing EIP-712 TransferWithAuthorization (ZG-USD domain)...');
  const r2 = await fetchWithPayment(`${SERVER}/report/${TOKEN_ID}`, {
    sourceToken: { address: ZGUSD, chainId: 16602 },
    buyerWallet: wallet as any,
    buyerAddress: account.address,
    assetDomainName: process.env.ZGUSD_NAME ?? 'ZG-USD',
    assetDomainVersion: process.env.ZGUSD_VERSION ?? '2',
  } as any);
  console.log(`    status: ${r2.status}`);
  if (!r2.ok) {
    console.error('    body:', await r2.text());
    process.exit(1);
  }
  const body = await r2.json();
  console.log(`\n[4] Server unlocked report (${(body.report as string).length} chars)`);
  console.log(`    settleTxHash: ${body.settleTxHash ?? '(none)'}`);
  console.log(`    authzTxHash:  ${body.authzTxHash ?? '(none)'}`);
  console.log(`    auditId:      ${body.auditId ?? '(none)'}`);

  // Post-flight balances
  const buyerBalAfter = await (tok as any).balanceOf(account.address);
  const sellerBalAfter = await (tok as any).balanceOf(sellerAddr);
  console.log(`\nPost-flight balances:`);
  console.log(`  buyer  ZGUSD: ${ethers.formatUnits(buyerBalAfter, decimals)}  (Δ ${ethers.formatUnits(buyerBalAfter - buyerBalBefore, decimals)})`);
  console.log(`  seller ZGUSD: ${ethers.formatUnits(sellerBalAfter, decimals)}  (Δ ${ethers.formatUnits(sellerBalAfter - sellerBalBefore, decimals)})`);

  console.log('\n✓ End-to-end ZGUSD buy flow complete.');
  if (body.settleTxHash) {
    console.log(`  Settlement tx:    ${process.env.ZG_EXPLORER}/tx/${body.settleTxHash}`);
  }
  if (body.authzTxHash) {
    console.log(`  authorizeUsage tx: ${process.env.ZG_EXPLORER}/tx/${body.authzTxHash}`);
  }
}

main().catch((e) => { console.error('FAILED:', e?.message ?? e); process.exit(1); });
