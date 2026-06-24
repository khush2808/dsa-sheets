create table if not exists public.user_problem_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_id text not null,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, problem_id)
);

create table if not exists public.user_problem_notes (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_id text not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists user_problem_notes_user_problem_idx
  on public.user_problem_notes (user_id, problem_id, updated_at desc);

alter table public.user_problem_progress enable row level security;
alter table public.user_problem_notes enable row level security;

drop policy if exists "Users can read own progress" on public.user_problem_progress;
create policy "Users can read own progress"
  on public.user_problem_progress
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own progress" on public.user_problem_progress;
create policy "Users can insert own progress"
  on public.user_problem_progress
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own progress" on public.user_problem_progress;
create policy "Users can update own progress"
  on public.user_problem_progress
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own progress" on public.user_problem_progress;
create policy "Users can delete own progress"
  on public.user_problem_progress
  for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read own notes" on public.user_problem_notes;
create policy "Users can read own notes"
  on public.user_problem_notes
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own notes" on public.user_problem_notes;
create policy "Users can insert own notes"
  on public.user_problem_notes
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own notes" on public.user_problem_notes;
create policy "Users can update own notes"
  on public.user_problem_notes
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own notes" on public.user_problem_notes;
create policy "Users can delete own notes"
  on public.user_problem_notes
  for delete
  using (auth.uid() = user_id);
