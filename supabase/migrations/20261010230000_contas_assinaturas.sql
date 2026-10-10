-- Fábrica de Conteúdo: contas, papéis, assinaturas (Kiwify) e registro de vendas.
-- Pode rodar mais de uma vez sem quebrar.

-- ===== Papéis (dono do app = admin) =====
do $$ begin
  create type public.app_role as enum ('admin', 'cliente');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

drop policy if exists "ver os próprios papéis" on public.user_roles;
create policy "ver os próprios papéis" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- ===== Perfis =====
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nome text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "ver o próprio perfil" on public.profiles;
create policy "ver o próprio perfil" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "editar o próprio perfil" on public.profiles;
create policy "editar o próprio perfil" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- O cliente não pode trocar o e-mail do perfil por conta própria.
create or replace function public.profiles_protege_email()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.email is distinct from old.email and not public.has_role(auth.uid(), 'admin') then
    new.email := old.email;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_protege_email on public.profiles;
create trigger profiles_protege_email
  before update on public.profiles
  for each row execute function public.profiles_protege_email();

-- ===== Assinaturas =====
create table if not exists public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  user_id uuid references auth.users (id) on delete set null,
  plano text not null check (plano in ('mensal', 'vitalicio')),
  status text not null check (status in ('ativo', 'atrasado', 'cancelado', 'reembolsado', 'expirado')),
  valido_ate timestamptz,
  origem text not null default 'kiwify' check (origem in ('kiwify', 'manual')),
  kiwify_order_id text,
  kiwify_subscription_id text,
  valor_centavos integer,
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists assinaturas_user_id_idx on public.assinaturas (user_id);
alter table public.assinaturas enable row level security;

-- Guarda sempre o e-mail em minúsculas para casar com a conta.
create or replace function public.assinaturas_normaliza()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.email := lower(trim(new.email));
  new.atualizado_em := now();
  if new.user_id is null then
    select id into new.user_id from auth.users
    where lower(email) = new.email and email_confirmed_at is not null
    limit 1;
  end if;
  return new;
end $$;

drop trigger if exists assinaturas_normaliza on public.assinaturas;
create trigger assinaturas_normaliza
  before insert or update on public.assinaturas
  for each row execute function public.assinaturas_normaliza();

drop policy if exists "ver a própria assinatura" on public.assinaturas;
create policy "ver a própria assinatura" on public.assinaturas
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "dono gerencia assinaturas" on public.assinaturas;
create policy "dono gerencia assinaturas" on public.assinaturas
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ===== Registro dos avisos da Kiwify =====
create table if not exists public.eventos_kiwify (
  id uuid primary key default gen_random_uuid(),
  recebido_em timestamptz not null default now(),
  tipo text,
  status_pedido text,
  email text,
  produto text,
  order_id text,
  valor_centavos integer,
  assinatura_valida boolean not null default false,
  processado boolean not null default false,
  erro text,
  payload jsonb
);
create index if not exists eventos_kiwify_recebido_idx on public.eventos_kiwify (recebido_em desc);
alter table public.eventos_kiwify enable row level security;

drop policy if exists "dono vê eventos" on public.eventos_kiwify;
create policy "dono vê eventos" on public.eventos_kiwify
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- ===== Segredos (token da Kiwify). Ninguém lê pelo app; só o servidor. =====
create table if not exists public.app_secrets (
  chave text primary key,
  valor text not null,
  atualizado_em timestamptz not null default now()
);
alter table public.app_secrets enable row level security;

create or replace function public.admin_set_secret(_chave text, _valor text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Somente o dono do app pode fazer isso.';
  end if;
  if _chave not in ('kiwify_token') then
    raise exception 'Chave desconhecida.';
  end if;
  insert into public.app_secrets (chave, valor, atualizado_em)
  values (_chave, trim(_valor), now())
  on conflict (chave) do update set valor = excluded.valor, atualizado_em = now();
end $$;

create or replace function public.admin_has_secret(_chave text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'admin')
     and exists (select 1 from public.app_secrets where chave = _chave and length(valor) > 0)
$$;

-- ===== Acesso às ferramentas =====
create or replace function public.tem_acesso()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_role(auth.uid(), 'admin')
    or exists (
      select 1 from public.assinaturas a
      where a.user_id = auth.uid()
        and (
          (a.status in ('ativo', 'atrasado')
            and (a.plano = 'vitalicio' or a.valido_ate is null or a.valido_ate > now()))
          or (a.status = 'cancelado' and a.plano = 'mensal' and a.valido_ate > now())
        )
    )
$$;

-- ===== Nova conta: cria o perfil; com e-mail confirmado, liga compras e define o dono =====
create or replace function public.liga_conta_confirmada(_id uuid, _email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.assinaturas set user_id = _id where email = lower(_email) and user_id is null;
  if lower(_email) = 'dhavisoares9@gmail.com' then
    insert into public.user_roles (user_id, role) values (_id, 'admin') on conflict do nothing;
  end if;
end $$;
revoke all on function public.liga_conta_confirmada(uuid, text) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nome, avatar_url)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'cliente') on conflict do nothing;
  if new.email_confirmed_at is not null then
    perform public.liga_conta_confirmada(new.id, new.email);
  end if;
  return new;
end $$;

create or replace function public.handle_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    perform public.liga_conta_confirmada(new.id, new.email);
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function public.handle_user_confirmed();

-- Permissões das funções chamadas pelo app.
revoke all on function public.admin_set_secret(text, text) from public, anon;
grant execute on function public.admin_set_secret(text, text) to authenticated;
grant execute on function public.admin_has_secret(text) to authenticated;
grant execute on function public.tem_acesso() to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

-- ===== Configuração pública (links de checkout e preços), editada no Painel do dono =====
create table if not exists public.app_config (
  chave text primary key check (chave in ('checkout_mensal', 'checkout_vitalicio', 'preco_mensal', 'preco_vitalicio')),
  valor text not null,
  atualizado_em timestamptz not null default now()
);
alter table public.app_config enable row level security;

drop policy if exists "todos leem a configuração pública" on public.app_config;
create policy "todos leem a configuração pública" on public.app_config
  for select to anon, authenticated
  using (true);

drop policy if exists "dono edita a configuração" on public.app_config;
create policy "dono edita a configuração" on public.app_config
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

insert into public.app_config (chave, valor) values
  ('preco_mensal', 'R$ 47'),
  ('preco_vitalicio', 'R$ 497')
on conflict (chave) do nothing;
