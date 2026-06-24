# Auth and Backend

## Current Stack

The project uses:

- Supabase Auth for Email, Google, and GitHub sign-in.
- Supabase Postgres for progress and notes.
- Supabase Row Level Security so users can only read/write their own rows.
- Browser-side Supabase client calls with the publishable key.
- localStorage as anonymous mode and offline cache.

There are currently no custom API routes for progress. Both the static app and the Next app talk directly to Supabase.

## Database Schema

Current migrations live in `supabase/migrations/`.

Progress:

```sql
create table public.user_problem_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_id text not null,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, problem_id)
);
```

Notes:

```sql
create table public.user_problem_notes (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_id text not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
```

RLS policies allow `select`, `insert`, `update`, and `delete` only when:

```sql
auth.uid() = user_id
```

## Security Notes

The browser only receives public Supabase values:

- `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `SUPABASE_PUBLISHABLE_KEY`

Never expose service-role keys in browser code.

The migration `20260624193446_drop_rls_auto_enable.sql` removes an old `SECURITY DEFINER` helper function and its event trigger:

```sql
drop event trigger if exists ensure_rls;
drop function if exists public.rls_auto_enable();
```

This fixed Supabase Advisor warnings where `public.rls_auto_enable()` was callable by `anon` and `authenticated`.

## Frontend Sync Model

Both frontends use the same conceptual adapter shape:

```ts
loadAll()
saveProblem(problemId, value)
saveProblems(updates)
```

Anonymous mode:

- Read/write `localStorage`.
- Never block page rendering on auth or network calls.

Signed-in mode:

1. Load local records.
2. Load remote records from Supabase.
3. Merge by timestamp.
4. Save merged records locally.
5. Push merged records back to Supabase.

Notes merge by `id`. `noteTombstones` preserve local/offline deletions so older remote notes do not reappear later.

## Remaining External Setup

Code cannot fully complete these dashboard tasks:

- Enable and configure Email Auth in Supabase if not already enabled.
- Configure Google OAuth provider in Supabase and Google Cloud.
- Configure GitHub OAuth provider in Supabase and GitHub Developer Settings.
- Add all production and local redirect URLs to Supabase Auth URL Configuration.
- Add public Supabase env vars to GitHub Pages and Vercel.

See [OAuth Setup](./oauth-setup.md) and [Deployment and Environments](./deployment.md).

## Future Improvements

- Add end-to-end auth tests once provider setup is stable.
- Add a server/API layer only if direct Supabase client access becomes too limiting.
- Add explicit sync conflict UI if cross-device edits become common.
- Consider migrating fully to Next.js after GitHub Pages support is no longer needed or Next static export is accepted there.
