-- ARTX Hub: rode este arquivo no SQL Editor do Supabase.
-- Cada registro pertence ao usuário autenticado; ninguém mais consegue lê-lo.
create table if not exists public.hub_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 5000),
  project_slug text,
  created_at timestamptz not null default now()
);

create table if not exists public.hub_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  project_slug text,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.hub_notes enable row level security;
alter table public.hub_tasks enable row level security;

create policy "users manage own notes" on public.hub_notes for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "users manage own tasks" on public.hub_tasks for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
