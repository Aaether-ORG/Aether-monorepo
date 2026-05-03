import 'dotenv/config';
import { ethers } from 'ethers';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createZGComputeNetworkBroker } = require('@0gfoundation/0g-compute-ts-sdk');

const provider = new ethers.JsonRpcProvider(process.env.ZG_RPC_URL!);
const wallet = new ethers.Wallet(process.env.ZG_TESTNET_PRIVATE_KEY!, provider);
const broker = await createZGComputeNetworkBroker(wallet);
const providerAddr = process.env.ZG_COMPUTE_PROVIDER_ADDRESS!;

const meta = await broker.inference.getServiceMetadata(providerAddr);
console.log('META:', JSON.stringify(meta, null, 2));

const payload = JSON.stringify({
  model: meta.model,
  messages: [{ role: 'user', content: 'hi' }],
});
const headers = await broker.inference.getRequestHeaders(providerAddr, payload);
console.log('Headers keys:', Object.keys(headers));

// Try several endpoint variants — some providers expose under different paths
const candidates = [
  `${meta.endpoint}/chat/completions`,
  `${meta.endpoint}/v1/chat/completions`,
];
for (const url of candidates) {
  console.log('\n→ Calling:', url);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: payload,
    });
    console.log('  Status:', res.status);
    const text = await res.text();
    console.log('  Body  :', text.slice(0, 400));
    if (res.ok) {
      console.log('\n✓ This URL works!');
      break;
    }
  } catch (e: any) {
    console.log('  Error:', e?.message);
  }
}
