import { mkdir, writeFile } from 'node:fs/promises';
import { readPublicSupabaseEnv } from './supabase-env.mjs';

const { url, publishableKey } = await readPublicSupabaseEnv();

await mkdir('next-app', { recursive: true });
await writeFile(
  'next-app/.env.local',
  `NEXT_PUBLIC_SUPABASE_URL=${url}
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishableKey}
`
);
