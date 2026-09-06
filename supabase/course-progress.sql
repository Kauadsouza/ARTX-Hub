-- ARTX Hub: progresso privado da area Curriculo & Cursos.
-- Migracao aditiva e idempotente. Nao remove nem altera dados existentes.
begin;

create table if not exists public.hub_course_progress (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id text not null check (char_length(course_id) between 1 and 120),
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed')),
  progress_percent smallint not null default 0 check (progress_percent between 0 and 100),
  current_step text check (current_step is null or char_length(current_step) <= 500),
  next_step text check (next_step is null or char_length(next_step) <= 500),
  private_note text check (private_note is null or char_length(private_note) <= 3000),
  certificate_url text check (certificate_url is null or (char_length(certificate_url) <= 2048 and certificate_url ~ '^https://')),
  completed_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

-- Atualiza instalacoes que ja tinham a primeira versao da tabela.
alter table public.hub_course_progress
  add column if not exists progress_percent smallint not null default 0 check (progress_percent between 0 and 100),
  add column if not exists current_step text check (current_step is null or char_length(current_step) <= 500),
  add column if not exists next_step text check (next_step is null or char_length(next_step) <= 500),
  add column if not exists private_note text check (private_note is null or char_length(private_note) <= 3000);

alter table public.hub_course_progress enable row level security;
alter table public.hub_course_progress force row level security;

revoke all on public.hub_course_progress from anon;
grant select, insert, update, delete on public.hub_course_progress to authenticated;

drop policy if exists "Owner manages course progress" on public.hub_course_progress;
create policy "Owner manages course progress" on public.hub_course_progress
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create index if not exists hub_course_progress_owner_updated_idx
  on public.hub_course_progress (user_id, updated_at desc);

commit;
