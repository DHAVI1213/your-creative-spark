-- Cada cliente usa suas próprias contas e chaves, lidas apenas pelo servidor.
create table if not exists public.editor_conexoes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  configuracao jsonb not null default '{}'::jsonb
);
alter table public.editor_conexoes enable row level security;
revoke all on public.editor_conexoes from public, anon, authenticated;
grant select, insert, update, delete on public.editor_conexoes to service_role;
