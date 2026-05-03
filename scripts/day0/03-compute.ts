/**
 * Day 0 — Check 3: 0G Compute broker can list services and (optionally) call inference.
 */
import { ethers } from 'ethers';
import { createRequire } from 'node:module';
import { env, ok, fail, info, heading, optionalEnv } from './_lib.js';

// The 0G Compute SDK ships with a chunk-style ESM build that breaks under
// tsx/esbuild. Force CJS loading via createRequire — works reliably.
const require = createRequire(import.meta.url);

async function main() {
  heading('Day-0 Check 3: 0G Compute');

  const { createZGComputeNetworkBroker } = require('@0gfoundation/0g-compute-ts-sdk');

  const provider = new ethers.JsonRpcProvider(env('ZG_RPC_URL'));
  const wallet = new ethers.Wallet(env('ZG_TESTNET_PRIVATE_KEY'), provider);

  info('Initializing broker...');
  const broker = await createZGComputeNetworkBroker(wallet);

  // 3a. Ledger status
  try {
    const ledger = await broker.ledger.getLedger();
    info(`Ledger: total=${ledger?.totalBalance ?? 0}  locked=${ledger?.locked ?? 0}`);
  } catch (e: any) {
    info(`Ledger: not initialized yet (${e?.message ?? e}).`);
    info('  → Run: broker.ledger.addLedger(0.5)  to fund the ledger.');
  }

  // 3b. List services
  const services = await broker.inference.listService();
  ok(`Discovered ${services.length} inference services.`);
  services.slice(0, 5).forEach((s: any) => {
    info(`  ${s.model}  by  ${s.provider}  url=${s.url}`);
  });

  // 3c. Default provider
  const defaultModel = env('ZG_COMPUTE_DEFAULT_MODEL', 'glm-5-fp8');
  const target = services.find((s: any) => s.model === defaultModel);
  if (!target) {
    fail(`No provider found for model ${defaultModel}. Try one of:`);
    services.forEach((s: any) => console.log(`    - ${s.model}`));
    process.exit(1);
  }
  ok(`Found provider for ${defaultModel}: ${target.provider}`);
  info(`Set ZG_COMPUTE_PROVIDER_ADDRESS=${target.provider} in .env`);

  // 3d. (optional) Test inference if user opts in
  if (optionalEnv('TEST_INFERENCE') === '1') {
    info('Test inference call...');
    try {
      await broker.inference.acknowledgeProviderSigner(target.provider);
    } catch (e: any) {
      // already acknowledged
    }

    const payload = JSON.stringify({
      messages: [{ role: 'user', content: 'Reply with a single emoji.' }],
      model: defaultModel,
    });
    const meta = await broker.inference.getServiceMetadata(target.provider);
    const headers = await broker.inference.getRequestHeaders(target.provider, payload);

    const res = await fetch(`${meta.endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: payload,
    });
    const data: any = await res.json();
    if (!res.ok) {
      fail(`Inference call failed: ${res.status} ${JSON.stringify(data)}`);
      process.exit(1);
    }
    ok(`Inference response: ${JSON.stringify(data?.choices?.[0]?.message?.content ?? data)}`);
    info(`TEE-like headers seen: ${[...res.headers.keys()].filter((k) => k.includes('tee') || k.includes('signature')).join(', ') || '(none)'}`);
  } else {
    info('Skipping inference call (set TEST_INFERENCE=1 to enable — costs 0G tokens).');
  }
}

main().catch((e) => {
  fail(e.message);
  process.exit(1);
});
