create table if not exists public.viral_buscas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  perfil jsonb not null,
  run_id text,
  download_run text,
  download_iniciado timestamptz,
  status text not null default 'processando',
  videos jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now()
);
alter table public.viral_buscas add column if not exists download_iniciado timestamptz;
alter table public.viral_buscas enable row level security;
revoke all on public.viral_buscas from public, anon, authenticated;
grant select, insert, update, delete on public.viral_buscas to service_role;
create index if not exists viral_buscas_usuario on public.viral_buscas(user_id, criado_em);
create unique index if not exists viral_buscas_ativa on public.viral_buscas(user_id) where status = 'processando';
-- Amplia somente a lista de chaves; mantém a autorização e o token Kiwify.
create or replace function public.admin_set_secret(_chave text, _valor text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Somente o dono do app pode fazer isso.'; end if;
  if _chave not in ('kiwify_token', 'apify_token') then raise exception 'Chave desconhecida.'; end if;
  insert into public.app_secrets (chave, valor, atualizado_em) values (_chave, trim(_valor), now())
  on conflict (chave) do update set valor = excluded.valor, atualizado_em = now();
end $$;
revoke all on function public.admin_set_secret(text,text) from public, anon;
grant execute on function public.admin_set_secret(text,text) to authenticated;