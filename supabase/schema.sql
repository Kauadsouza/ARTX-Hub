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

drop policy if exists "users manage own notes" on public.hub_notes;
create policy "users manage own notes" on public.hub_notes for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "users manage own tasks" on public.hub_tasks;
create policy "users manage own tasks" on public.hub_tasks for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.hub_notes from anon;
revoke all on public.hub_tasks from anon;
grant select, insert, update, delete on public.hub_notes to authenticated;
grant select, insert, update, delete on public.hub_tasks to authenticated;

-- University Path: documento atual por etapa e histórico de versões.
create table if not exists public.university_documents (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  slot_id text not null check (char_length(slot_id) between 1 and 120),
  file_name text not null check (char_length(file_name) between 1 and 255),
  file_type text not null check (file_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size bigint not null check (size > 0 and size <= 15728640),
  storage_path text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot_id)
);

create table if not exists public.university_document_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  slot_id text not null check (char_length(slot_id) between 1 and 120),
  file_name text not null check (char_length(file_name) between 1 and 255),
  file_type text not null check (file_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size bigint not null check (size > 0 and size <= 15728640),
  storage_path text not null unique,
  updated_at timestamptz not null default now()
);

create index if not exists university_document_versions_owner_slot_idx
  on public.university_document_versions (user_id, slot_id, updated_at desc);

alter table public.university_documents enable row level security;
alter table public.university_document_versions enable row level security;

revoke all on public.university_documents from anon;
revoke all on public.university_document_versions from anon;
grant select, insert, update, delete on public.university_documents to authenticated;
grant select, insert, update, delete on public.university_document_versions to authenticated;

drop policy if exists "users manage own university documents" on public.university_documents;
create policy "users manage own university documents" on public.university_documents
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "users manage own university document versions" on public.university_document_versions;
create policy "users manage own university document versions" on public.university_document_versions
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('university-documents', 'university-documents', false, 15728640, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users read own university files" on storage.objects;
create policy "users read own university files" on storage.objects for select
  using (bucket_id = 'university-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "users upload own university files" on storage.objects;
create policy "users upload own university files" on storage.objects for insert
  with check (bucket_id = 'university-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "users update own university files" on storage.objects;
create policy "users update own university files" on storage.objects for update
  using (bucket_id = 'university-documents' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'university-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "users delete own university files" on storage.objects;
create policy "users delete own university files" on storage.objects for delete
  using (bucket_id = 'university-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
