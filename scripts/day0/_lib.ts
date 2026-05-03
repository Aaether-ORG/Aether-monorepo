import * as dotenv from 'dotenv';
import { resolve } from 'node:path';
import kleur from 'kleur';

dotenv.config({ path: resolve(import.meta.dirname, '..', '..', '.env') });

export const env = (key: string, fallback?: string): string => {
  const v = process.env[key] ?? fallback;
  if (v === undefined) throw new Error(`Missing env: ${key}`);
  return v;
};

export const optionalEnv = (key: string): string | undefined => process.env[key];

export const ok = (msg: string) => console.log(kleur.green('  ✓'), msg);
export const fail = (msg: string) => console.log(kleur.red('  ✗'), msg);
export const info = (msg: string) => console.log(kleur.cyan('  i'), msg);
export const heading = (msg: string) => console.log('\n' + kleur.bold().yellow(msg));
