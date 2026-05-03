/**
 * Start every Aether service in parallel and stream their logs colored by source.
 * Press Ctrl-C once to gracefully stop all of them.
 *
 *   pnpm e2e
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import kleur from 'kleur';

const ROOT = resolve(import.meta.dirname, '..', '..');

interface ServiceSpec {
  name: string;
  color: (s: string) => string;
  cmd: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
}

const services: ServiceSpec[] = [
  {
    name: 'tee',
    color: kleur.magenta,
    cmd: 'pnpm',
    args: ['--filter', '@aether/tee-worker', 'start'],
    cwd: ROOT,
  },
  {
    name: 'thornbury',
    color: kleur.cyan,
    cmd: 'pnpm',
    args: ['--filter', '@aether/thornbury', 'server'],
    cwd: ROOT,
  },
  {
    name: 'ammonite',
    color: kleur.yellow,
    cmd: 'pnpm',
    args: ['--filter', '@aether/ammonite', 'dev:gateway'],
    cwd: ROOT,
  },
  {
    name: 'frontend',
    color: kleur.green,
    cmd: 'pnpm',
    args: ['--filter', '@aether/frontend', 'dev'],
    cwd: ROOT,
  },
];

const procs: ChildProcess[] = [];

for (const svc of services) {
  console.log(svc.color(`[${svc.name}]`), `starting...`);
  const child = spawn(svc.cmd, svc.args, {
    cwd: svc.cwd,
    env: { ...process.env, ...svc.env, FORCE_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  procs.push(child);

  const pipe = (stream: NodeJS.ReadableStream, isErr = false) => {
    stream.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim().length === 0) continue;
        const prefix = svc.color(`[${svc.name}]`);
        if (isErr) {
          process.stderr.write(`${prefix} ${kleur.red(line)}\n`);
        } else {
          process.stdout.write(`${prefix} ${line}\n`);
        }
      }
    });
  };
  pipe(child.stdout!);
  pipe(child.stderr!, true);

  child.on('exit', (code) => {
    console.log(svc.color(`[${svc.name}]`), `exited with code ${code}`);
  });
}

console.log('\n' + kleur.bold('═══════════════════════════════════════'));
console.log(kleur.bold('  AETHER — All services running'));
console.log(kleur.bold('═══════════════════════════════════════\n'));
console.log('  Frontend         : http://localhost:5173');
console.log('  Thornbury server : http://localhost:3000');
console.log('  TEE worker       : http://localhost:4000');
console.log('  Ammonite gateway : http://localhost:8080');
console.log('\n  Ctrl-C once to stop everything.\n');

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\n' + kleur.yellow('Shutting down...'));
  for (const p of procs) {
    if (!p.killed) p.kill('SIGTERM');
  }
  setTimeout(() => process.exit(0), 1500);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
