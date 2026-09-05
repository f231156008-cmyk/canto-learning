create table if not exists public.learning_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempts jsonb not null default '[]'::jsonb,
  mastered_chars jsonb not null default '[]'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  app_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.learning_state
  add column if not exists app_state jsonb not null default '{}'::jsonb;

alter table public.learning_state enable row level security;

drop policy if exists "read own learning state" on public.learning_state;
create policy "read own learning state" on public.learning_state
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "insert own learning state" on public.learning_state;
create policy "insert own learning state" on public.learning_state
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "update own learning state" on public.learning_state;
create policy "update own learning state" on public.learning_state
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
