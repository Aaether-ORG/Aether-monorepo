/**
 * Day 0 — Check 5: AetherVerifier deploys and tests pass.
 *
 * Just delegates to the contracts workspace.
 */
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { heading, ok, fail } from './_lib.js';

async function main() {
  heading('Day-0 Check 5: AetherVerifier compile + test');
  const root = resolve(import.meta.dirname, '..', '..', 'contracts');

  try {
    execSync('pnpm hardhat compile', { cwd: root, stdio: 'inherit' });
    ok('Compile OK');
    execSync('pnpm hardhat test', { cwd: root, stdio: 'inherit' });
    ok('Tests pass');
  } catch (e) {
    fail('Compile/test failed — see output above.');
    process.exit(1);
  }
}

main();
