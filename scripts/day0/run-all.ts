/**
 * Day 0 — Run all checks. Exits non-zero on first failure.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import kleur from 'kleur';

const checks = [
  '01-rpc.ts',
  '02-balance.ts',
  '03-compute.ts',
  '04-storage.ts',
  '06-erc8004.ts',
  '07-durin.ts',
  '08-x402.ts',
  '09-keeperhub.ts',
  '10-ens.ts',
];

console.log(kleur.bold().cyan('\n════════════════════════════════'));
console.log(kleur.bold().cyan('  AETHER — Day 0 verification'));
console.log(kleur.bold().cyan('════════════════════════════════\n'));

const results: { check: string; ok: boolean }[] = [];

for (const c of checks) {
  const p = spawnSync('tsx', [resolve(import.meta.dirname, c)], {
    stdio: 'inherit',
    env: process.env,
  });
  results.push({ check: c, ok: p.status === 0 });
  if (p.status !== 0) {
    console.log(kleur.red(`\n${c} FAILED. Stopping.`));
    break;
  }
}

console.log('\n' + kleur.bold('═══ Summary ═══'));
for (const r of results) {
  console.log(`  ${r.ok ? kleur.green('PASS') : kleur.red('FAIL')}  ${r.check}`);
}
const passed = results.every((r) => r.ok);
process.exit(passed ? 0 : 1);
