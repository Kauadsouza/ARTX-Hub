-- Additive migration: private study and university progress. Existing data is untouched.
begin;
create table if not exists public.hub_app_state (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  app text not null check (app in ('study', 'university')),
  profile text not null check (char_length(profile) between 1 and 120),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 4194304),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, app, profile)
);
alter table public.hub_app_state enable row level security;
revoke all on public.hub_app_state from anon;
grant select, insert, update on public.hub_app_state to authenticated;
drop policy if exists "Owner manages app state" on public.hub_app_state;
create policy "Owner manages app state" on public.hub_app_state to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function public.save_hub_app_state(p_app text, p_profile text, p_payload jsonb, p_revision integer)
returns integer language plpgsql security invoker set search_path = '' as $$
declare next_revision integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_revision = 0 then
    insert into public.hub_app_state(user_id, app, profile, payload)
    values(auth.uid(), p_app, p_profile, p_payload)
    on conflict do nothing returning revision into next_revision;
  else
    update public.hub_app_state set payload = p_payload, revision = revision + 1, updated_at = now()
    where user_id = auth.uid() and app = p_app and profile = p_profile and revision = p_revision
    returning revision into next_revision;
  end if;
  if next_revision is null then raise exception 'Newer progress exists on another device' using errcode = '40001'; end if;
  return next_revision;
end;
$$;
revoke all on function public.save_hub_app_state(text, text, jsonb, integer) from public, anon;
grant execute on function public.save_hub_app_state(text, text, jsonb, integer) to authenticated;
create index if not exists hub_tasks_owner_created_idx on public.hub_tasks(user_id, created_at desc);
create index if not exists hub_notes_owner_created_idx on public.hub_notes(user_id, created_at desc);
create table if not exists public.study_generation_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  count integer not null
);
alter table public.study_generation_limits enable row level security;
revoke all on public.study_generation_limits from anon, authenticated;
create or replace function public.claim_study_generation()
returns boolean language plpgsql security definer set search_path = '' as $$
declare hits integer;
begin
  if auth.uid() is null then return false; end if;
  insert into public.study_generation_limits as quota(user_id, window_start, count)
    values (auth.uid(), now(), 1)
    on conflict (user_id) do update set
      count = case when quota.window_start < now() - interval '1 hour' then 1 else quota.count + 1 end,
      window_start = case when quota.window_start < now() - interval '1 hour' then now() else quota.window_start end
    returning count into hits;
  return hits <= 20;
end;
$$;
revoke all on function public.claim_study_generation() from public, anon;
grant execute on function public.claim_study_generation() to authenticated;
commit;
