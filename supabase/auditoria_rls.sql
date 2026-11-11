-- Auditoria de segurança do banco (issue #12) — SOMENTE LEITURA.
-- Não lê nenhum dado de usuário: só estrutura (tabelas, colunas, políticas,
-- permissões, funções, triggers, buckets) e contagens agregadas.
-- Rodar no Supabase: SQL Editor > New query > colar > Run.
-- O resultado é uma única célula JSON: copie e salve em
-- AlugApp/supabase/auditoria_rls_resultado.json

with
tabelas as (
  select c.relname as tabela,
         c.relrowsecurity as rls_ativo,
         c.relforcerowsecurity as rls_forcado
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
),
colunas as (
  select table_name as tabela,
         json_agg(json_build_object('coluna', column_name, 'tipo', data_type,
                                    'nulo', is_nullable, 'padrao', column_default)
                  order by ordinal_position) as colunas
  from information_schema.columns
  where table_schema = 'public'
  group by table_name
),
politicas as (
  select schemaname as schema, tablename as tabela, policyname as politica,
         permissive, roles, cmd as comando, qual as using_expr, with_check as check_expr
  from pg_policies
  where schemaname in ('public', 'storage')
),
permissoes as (
  select table_name as tabela, grantee as papel,
         string_agg(privilege_type, ',' order by privilege_type) as privilegios
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'authenticated')
  group by table_name, grantee
),
permissoes_coluna as (
  select table_name as tabela, column_name as coluna, grantee as papel,
         string_agg(privilege_type, ',' order by privilege_type) as privilegios
  from information_schema.column_privileges
  where table_schema = 'public' and grantee in ('anon', 'authenticated')
    and table_name = 'users'
  group by table_name, column_name, grantee
),
funcoes as (
  select p.proname as funcao,
         pg_get_function_identity_arguments(p.oid) as argumentos,
         p.prosecdef as security_definer,
         p.proconfig as config,
         has_function_privilege('anon', p.oid, 'EXECUTE') as anon_executa,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_executa,
         p.prosrc as corpo
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
),
gatilhos as (
  select event_object_table as tabela, trigger_name as gatilho,
         string_agg(event_manipulation, ',') as eventos,
         action_timing as momento, action_statement as acao
  from information_schema.triggers
  where trigger_schema = 'public'
  group by event_object_table, trigger_name, action_timing, action_statement
),
buckets as (
  select id, public as publico, file_size_limit, allowed_mime_types
  from storage.buckets
),
realtime as (
  select tablename as tabela from pg_publication_tables
  where pubname = 'supabase_realtime'
),
contagens as (
  select
    (select count(*) from auth.users) as auth_users,
    (select count(*) from auth.users where email_confirmed_at is null) as auth_users_sem_confirmacao,
    (select count(*) from public.users) as perfis,
    (select count(*) from public.users u
       where not exists (select 1 from auth.users a where a.id = u.auth_id)) as perfis_sem_auth
)
select json_build_object(
  'tabelas',           (select json_agg(t order by t.tabela) from tabelas t),
  'colunas',           (select json_object_agg(c.tabela, c.colunas) from colunas c),
  'politicas',         (select json_agg(p order by p.schema, p.tabela, p.politica) from politicas p),
  'permissoes',        (select json_agg(g order by g.tabela, g.papel) from permissoes g),
  'permissoes_coluna_users', (select json_agg(g order by g.coluna, g.papel) from permissoes_coluna g),
  'funcoes',           (select json_agg(f order by f.funcao) from funcoes f),
  'gatilhos',          (select json_agg(g order by g.tabela, g.gatilho) from gatilhos g),
  'buckets',           (select json_agg(b order by b.id) from buckets b),
  'realtime',          (select json_agg(r.tabela order by r.tabela) from realtime r),
  'contagens',         (select row_to_json(c) from contagens c)
) as auditoria;
