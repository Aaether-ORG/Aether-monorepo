/**
 * CLI entrypoint — runs Thornbury once on a given question and prints the result.
 *
 * Usage:
 *   pnpm --filter @aether/thornbury research "your question here"
 */
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';
dotenvConfig({ path: resolve(import.meta.dirname, '..', '..', '..', '.env') });

import kleur from 'kleur';
import { runThornburyOnce } from './agent.js';

async function main() {
  const question = process.argv.slice(2).join(' ') ||
    'What are the most cited cell-free protein synthesis papers from Q1 2026?';

  console.log(kleur.cyan(`\n[Thornbury] question: ${question}\n`));

  const result = await runThornburyOnce({ question, attemptMint: true });

  console.log(kleur.green('\n=== FINAL REPORT ===\n'));
  console.log(result.finalReport);
  console.log(kleur.gray(`\nPapers consulted: ${result.papers.length}`));
  if (result.tokenId) {
    console.log(kleur.green(`iNFT #${result.tokenId}`));
    console.log(kleur.gray(`tx: ${process.env.ZG_EXPLORER}/tx/${result.txHash}`));
  }
}

main().catch((e) => {
  console.error(kleur.red(`[Thornbury] fatal: ${e?.message ?? e}`));
  process.exit(1);
});
