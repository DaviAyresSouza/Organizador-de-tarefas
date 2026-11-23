begin;

create table if not exists public.workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{"grupos":[]}'::jsonb,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;
revoke all on table public.workspaces from public, anon, authenticated;
grant select, insert, update on table public.workspaces to authenticated;

drop policy if exists "Usuários podem ler o próprio workspace" on public.workspaces;
create policy "Usuários podem ler o próprio workspace" on public.workspaces
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Usuários podem criar o próprio workspace" on public.workspaces;
create policy "Usuários podem criar o próprio workspace" on public.workspaces
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Usuários podem atualizar o próprio workspace" on public.workspaces;
create policy "Usuários podem atualizar o próprio workspace" on public.workspaces
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public)
values ('workos-media', 'workos-media', false)
on conflict (id) do update set public = false;

drop policy if exists "Permitir upload na própria pasta" on storage.objects;
create policy "Permitir upload na própria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'workos-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Permitir leitura na própria pasta" on storage.objects;
create policy "Permitir leitura na própria pasta" on storage.objects for select to authenticated
  using (bucket_id = 'workos-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Permitir exclusão na própria pasta" on storage.objects;
create policy "Permitir exclusão na própria pasta" on storage.objects for delete to authenticated
  using (bucket_id = 'workos-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
