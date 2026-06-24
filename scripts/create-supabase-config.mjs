import { readFile, writeFile } from 'node:fs/promises';

const parseEnv = (contents) =>
  Object.fromEntries(
    contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        const key = line.slice(0, index);
        const rawValue = line.slice(index + 1);
        const value = rawValue.replace(/^["']|["']$/g, '');
        return [key, value];
      })
  );

let fileEnv = {};
try {
  fileEnv = parseEnv(await readFile('.env', 'utf8'));
} catch {
  fileEnv = {};
}

const env = { ...fileEnv, ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const publishableKey =
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  env.SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  env.SUPABASE_ANON_KEY;

if (!url || !publishableKey) {
  throw new Error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
}

const output = `window.DSA_SUPABASE_CONFIG = ${JSON.stringify(
  {
    url,
    publishableKey
  },
  null,
  2
)};\n`;

await writeFile('assets/supabase-config.js', output);
