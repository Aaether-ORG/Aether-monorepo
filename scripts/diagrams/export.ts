/**
 * Export the Mermaid diagrams in docs/architecture-diagram.md to PNG/SVG.
 *
 * Requires `@mermaid-js/mermaid-cli` (`mmdc`).
 *
 *   pnpm dlx @mermaid-js/mermaid-cli -i input.mmd -o output.png
 *
 * Usage:
 *   pnpm tsx scripts/diagrams/export.ts
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const SRC = join(ROOT, 'docs', 'architecture-diagram.md');
const OUT = join(ROOT, 'docs', 'diagrams');

function extractMermaidBlocks(md: string): { name: string; code: string }[] {
  const blocks: { name: string; code: string }[] = [];
  const lines = md.split('\n');
  let lastHeading = 'diagram';
  let inBlock = false;
  let buffer: string[] = [];
  let blockIndex = 0;

  for (const line of lines) {
    const headingMatch = /^##+\s+(.+)/.exec(line);
    if (headingMatch && !inBlock) {
      lastHeading = headingMatch[1]!.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    if (line.trim() === '```mermaid') {
      inBlock = true; buffer = [];
      continue;
    }
    if (inBlock && line.trim() === '```') {
      blocks.push({
        name: `${String(blockIndex).padStart(2, '0')}-${lastHeading}`,
        code: buffer.join('\n'),
      });
      blockIndex++;
      inBlock = false;
      continue;
    }
    if (inBlock) buffer.push(line);
  }
  return blocks;
}

function main() {
  if (!existsSync(SRC)) throw new Error(`Source not found: ${SRC}`);
  const md = readFileSync(SRC, 'utf-8');
  const blocks = extractMermaidBlocks(md);
  console.log(`Found ${blocks.length} mermaid blocks.`);

  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

  for (const b of blocks) {
    const mmdPath = join(OUT, `${b.name}.mmd`);
    const pngPath = join(OUT, `${b.name}.png`);
    const svgPath = join(OUT, `${b.name}.svg`);
    writeFileSync(mmdPath, b.code);
    console.log(`  ${b.name}.mmd → ${pngPath}`);
    try {
      execSync(`pnpm dlx @mermaid-js/mermaid-cli -i "${mmdPath}" -o "${pngPath}" -t dark -b transparent`, { stdio: 'inherit' });
      execSync(`pnpm dlx @mermaid-js/mermaid-cli -i "${mmdPath}" -o "${svgPath}" -t dark -b transparent`, { stdio: 'inherit' });
    } catch (e) {
      console.error(`Failed to render ${b.name}: ${(e as Error).message}`);
    }
  }
  console.log(`\nDone. PNG/SVG files in ${OUT}/`);
  console.log('Use these in submission READMEs that don\'t render mermaid (most ETHGlobal portals).');
}

main();
