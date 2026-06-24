# Auth and Backend Plan

## Recommendation

Use:

- **Vercel** for hosting, preview deploys, production deploys, serverless API routes/functions, and environment variables.
- **Supabase Auth + Supabase Postgres** for authentication, user records, progress storage, notes, and Row Level Security.
- Keep the current frontend storage repository shape and add a backend adapter that can sync localStorage records into Supabase after sign-in.

This is the best fit for the project goal: low maintenance, low owner involvement, Git-backed deploys, and a backend that future agents can operate through migrations and environment variables.

## Why This Stack

### Vercel

The site already deploys on Vercel. Vercel Functions provide server-side endpoints without managing servers, and Vercel environment variables keep service keys outside source code.

Official docs:

- https://vercel.com/docs/functions
- https://vercel.com/docs/environment-variables

### Supabase

Supabase gives us Auth, Postgres, hosted APIs, and Row Level Security in one managed system. Supabase Auth integrates with database security, and RLS lets us enforce that users only read/write their own progress.

Official docs:

- https://supabase.com/docs/guides/auth
- https://supabase.com/docs/guides/database/postgres/row-level-security

## Alternative Stack

If the priority becomes the most polished auth UI and social login flows, use:

- Clerk for auth
- Neon or Supabase Postgres for data
- Vercel Functions for API endpoints

Clerk has excellent prebuilt UI and Next.js integration, but it adds a second core service. For this project, Supabase Auth is simpler because auth, database, and authorization live together.

Official Clerk docs:

- https://clerk.com/docs
- https://clerk.com/docs/nextjs/getting-started/quickstart

## Proposed Database Shape

Start with two tables instead of storing notes as JSON. This makes future note editing, deleting, and sorting cleaner.

```sql
create table user_problem_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_id text not null,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, problem_id)
);

create table user_problem_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_id text not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

RLS policy direction:

- users can select/insert/update/delete rows where `auth.uid() = user_id`
- no public access to progress or notes tables

## API Shape

Keep the frontend repository API close to what already exists:

```ts
type ProgressRecord = {
  completed?: boolean;
  notes: Array<{
    id: string;
    text: string;
    createdAt: string;
    updatedAt: string;
  }>;
  updatedAt?: string;
};
```

Suggested endpoints:

- `GET /api/progress`
- `PATCH /api/progress/:problemId`
- `PATCH /api/progress/bulk`
- `POST /api/progress/:problemId/notes`
- `PATCH /api/progress/:problemId/notes/:noteId`
- `DELETE /api/progress/:problemId/notes/:noteId`

If we move to direct Supabase client access with RLS, these can be replaced by Supabase client calls. The repository boundary should remain either way.

## Migration Path

1. Keep localStorage as the anonymous mode.
2. Add auth UI.
3. Add Supabase schema and RLS.
4. Add an API/Supabase progress adapter with the same methods as the local adapter:
   - `loadAll()`
   - `saveProblem(problemId, value)`
   - `saveProblems(updates)`
5. On sign-in, read localStorage and ask whether to merge local progress into the account.
6. After successful sync, keep localStorage as a cache/offline fallback.

## Sync Rules

Recommended merge behavior:

- `completed`: server wins only when local and server conflict with newer timestamps; otherwise choose the newest `updatedAt`.
- notes: merge by note `id`; if IDs differ, keep both.
- deleted notes: eventually add tombstones if cross-device sync becomes important.

For v1, keep it simple:

- upload local records on first sign-in
- then treat server as source of truth for signed-in users

## Framework Choice

The current static Vite site can stay as-is for local-only features. For auth/API work, migrate to **Next.js on Vercel** or add a small API service.

Recommendation: migrate to **Next.js on Vercel** when adding auth. It keeps frontend, API routes, auth middleware, and deployment in one place, which is easier for future automation.

Migration does not need to rewrite everything at once:

1. move static routes into Next pages/app routes
2. keep JSON data files
3. port `assets/app.js` behavior into components gradually
4. add auth and backend sync behind the existing progress repository

## Decision

Default plan unless requirements change:

```txt
Next.js on Vercel + Supabase Auth + Supabase Postgres/RLS
```

This is the most convenient stack for a solo-owner project where future agents should be able to deploy changes without the owner manually operating infrastructure.

