import { writeFile } from 'node:fs/promises';
import { readPublicSupabaseEnv } from './supabase-env.mjs';

const { url, publishableKey } = await readPublicSupabaseEnv();

const output = `window.DSA_SUPABASE_CONFIG = ${JSON.stringify(
  {
    url,
    publishableKey
  },
  null,
  2
)};\n`;

await writeFile('old/static/assets/supabase-config.js', output);
