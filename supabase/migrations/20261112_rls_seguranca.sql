-- =============================================================================
-- Issue #12 — Auditoria e correção das políticas RLS do Supabase
-- =============================================================================
-- Problemas encontrados na auditoria (supabase/auditoria_rls.sql, 10/11/2026):
--   1. users: políticas "Allow read/insert/update/delete" com USING (true) para
--      o papel public — qualquer pessoa com a chave anon lia CPF, e-mail,
--      telefone e endereço de todos e podia alterar ou apagar qualquer perfil.
--   2. admin_delete_item / admin_delete_user / admin_delete_avaliacao:
--      SECURITY DEFINER sem checagem de administrador e executáveis por anon —
--      qualquer pessoa podia apagar qualquer anúncio, usuário ou avaliação.
--   3. transacao_aluguel e mensagem_chat com leitura pública.
--   4. item e fotoitem aceitavam INSERT com CHECK (true), inclusive de anon.
--   5. Bucket items aceitava upload anônimo; avatars aceitava upload de
--      qualquer usuário logado em qualquer caminho.
--   6. Funções SECURITY DEFINER sem search_path fixo.
--
-- Modelo adotado:
--   * Dados pessoais (users) só para o próprio dono e para administradores.
--     Nome e foto de outras pessoas vêm da view perfil_publico.
--   * Anúncios, fotos, categorias e avaliações: leitura pública; escrita só
--     pelo dono.
--   * Solicitações, mensagens e transações: só os participantes (locador e
--     locatário) e administradores.
--   * Administrador é decidido no banco (tabela admins ou app_metadata.role),
--     nunca pelo navegador.
--   * Checagens de cadastro (e-mail/telefone/CPF já usados) e a criação do
--     perfil logo após o signUp (ainda sem sessão, pois "Confirm email" está
--     ligado) passam por funções que não devolvem dados pessoais.
--
-- Idempotente: pode ser executada mais de uma vez.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Administradores e funções auxiliares
-- -----------------------------------------------------------------------------
create table if not exists public.admins (
  email      text primary key check (email = lower(email)),
  criado_em  timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

-- Mesma lista de DEFAULT_ADMIN_EMAILS em src/lib/admin.ts
insert into public.admins (email) values
  ('mateusjoaquim10@gmail.com'),
  ('lucascarmonab@gmail.com'),
  ('paniaguacaua@gmail.com'),
  ('pedro.martins@firstdecision.com.br')
on conflict (email) do nothing;

-- Administrador: e-mail do JWT na tabela admins ou app_metadata.role = 'admin'
-- (app_metadata só pode ser alterado pelo service_role; user_metadata não é
-- confiável porque o próprio usuário pode alterá-lo).
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
      or exists (
           select 1 from public.admins a
           where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
         );
$$;

-- users.id do usuário logado. SECURITY DEFINER evita recursão de RLS quando
-- usada em políticas da própria tabela users ou de tabelas que a consultam.
create or replace function public.meu_usuario_id()
returns bigint
language sql stable security definer
set search_path = public
as $$
  select id from public.users where auth_id = auth.uid();
$$;

-- users.id do dono de um item (item.idlocador guarda o auth_id).
create or replace function public.dono_do_item(p_iditem integer)
returns bigint
language sql stable security definer
set search_path = public
as $$
  select u.id
  from public.item i
  join public.users u on u.auth_id = i.idlocador
  where i.iditem = p_iditem;
$$;

revoke all on function public.is_admin()                from public, anon, authenticated;
revoke all on function public.meu_usuario_id()          from public, anon, authenticated;
revoke all on function public.dono_do_item(integer)     from public, anon, authenticated;
grant execute on function public.is_admin()             to anon, authenticated;
grant execute on function public.meu_usuario_id()       to anon, authenticated;
grant execute on function public.dono_do_item(integer)  to authenticated;

-- Promover / revogar administrador (somente administradores)
create or replace function public.admin_definir_admin(p_email text, p_admin boolean)
returns boolean
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito a administradores' using errcode = '42501';
  end if;
  if p_admin then
    insert into public.admins (email) values (lower(trim(p_email)))
    on conflict (email) do nothing;
  else
    delete from public.admins where email = lower(trim(p_email));
  end if;
  return true;
end;
$$;
revoke all on function public.admin_definir_admin(text, boolean) from public, anon, authenticated;
grant execute on function public.admin_definir_admin(text, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Remove todas as políticas antigas das tabelas tratadas aqui
--    (havia duplicadas e permissivas; recriamos um conjunto único e nomeado)
-- -----------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('users', 'item', 'fotoitem', 'categoria', 'avaliacao',
                        'solicitacao_aluguel', 'mensagem', 'mensagem_chat',
                        'transacao_aluguel', 'pagamento', 'notificacao',
                        'ticket_suporte')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;

  for r in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname in ('Public upload', 'avatars_auth_insert', 'avatars_owner_update',
                         'items_upload_autenticado', 'avatars_insert_proprio',
                         'avatars_update_proprio')
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end $$;

-- Garante RLS ligado em todas as tabelas de negócio
alter table public.users               enable row level security;
alter table public.item                enable row level security;
alter table public.fotoitem            enable row level security;
alter table public.categoria           enable row level security;
alter table public.avaliacao           enable row level security;
alter table public.solicitacao_aluguel enable row level security;
alter table public.mensagem            enable row level security;
alter table public.mensagem_chat       enable row level security;
alter table public.transacao_aluguel   enable row level security;
alter table public.pagamento           enable row level security;
alter table public.notificacao         enable row level security;
alter table public.ticket_suporte      enable row level security;

-- -----------------------------------------------------------------------------
-- 3. Permissões de tabela (defesa em profundidade, além da RLS)
-- -----------------------------------------------------------------------------
-- Ninguém do lado do cliente precisa de TRUNCATE/TRIGGER/REFERENCES
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;

-- Visitante (anon) só lê o catálogo público; não escreve em nada
revoke insert, update, delete on all tables in schema public from anon;
revoke select on public.users, public.solicitacao_aluguel, public.mensagem,
                 public.mensagem_chat, public.transacao_aluguel, public.pagamento,
                 public.notificacao, public.ticket_suporte
  from anon;

-- -----------------------------------------------------------------------------
-- 4. users — dados pessoais
-- -----------------------------------------------------------------------------
create policy users_select_proprio on public.users
  for select to authenticated
  using (auth_id = (select auth.uid()));

create policy users_select_admin on public.users
  for select to authenticated
  using ((select public.is_admin()));

-- Login Google (CompletarPerfil) cria o perfil já com sessão
create policy users_insert_proprio on public.users
  for insert to authenticated
  with check (auth_id = (select auth.uid()));

create policy users_update_proprio on public.users
  for update to authenticated
  using (auth_id = (select auth.uid()))
  with check (auth_id = (select auth.uid()));

-- Sem política de DELETE: exclusão só por delete_user_account (próprio
-- usuário, com senha) ou admin_delete_user (administrador).

-- Impede que o cliente troque id, auth_id, email ou created_at do perfil.
-- O e-mail é sincronizado pelo gatilho sync_user_email_on_auth_change, que
-- roda como dono da função (não como anon/authenticated).
create or replace function public.fn_users_protege_colunas()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.id is distinct from old.id
       or new.auth_id is distinct from old.auth_id
       or new.email is distinct from old.email
       or new.created_at is distinct from old.created_at then
      raise exception 'Não é permitido alterar id, auth_id, email ou created_at do perfil'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_users_protege_colunas on public.users;
create trigger trg_users_protege_colunas
  before update on public.users
  for each row execute function public.fn_users_protege_colunas();

-- Perfil público: só o necessário para exibir o outro lado de um anúncio,
-- solicitação ou conversa. Roda com os privilégios do dono da view (ignora a
-- RLS de users) e expõe apenas estas colunas.
create or replace view public.perfil_publico
with (security_invoker = false)
as
  select id, auth_id, "fullName", avatar_url
  from public.users;

revoke all on public.perfil_publico from anon, authenticated;
grant select on public.perfil_publico to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Cadastro e recuperação de senha sem expor a tabela users
-- -----------------------------------------------------------------------------
-- Responde apenas se já existe cadastro com o e-mail, telefone ou CPF.
create or replace function public.cadastro_existe(
  p_email text default null,
  p_phone text default null,
  p_cpf   text default null
)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where (p_email is not null and lower(u.email) = lower(trim(p_email)))
       or (p_phone is not null and u.phone = p_phone)
       or (p_cpf   is not null and u.cpf   = p_cpf)
  );
$$;
revoke all on function public.cadastro_existe(text, text, text) from public, anon, authenticated;
grant execute on function public.cadastro_existe(text, text, text) to anon, authenticated;

-- Cria o perfil logo após o signUp. Com "Confirm email" ligado ainda não há
-- sessão, então a função valida que a conta de autenticação existe, tem o
-- mesmo e-mail, foi criada há menos de 1 hora (ou é a do usuário logado) e
-- ainda não tem perfil.
create or replace function public.criar_perfil_cadastro(
  p_auth_id     uuid,
  p_full_name   text,
  p_email       text,
  p_cpf         text,
  p_birth_date  date,
  p_phone       text,
  p_gender      text,
  p_cep         text,
  p_rua         text,
  p_numero      text,
  p_complemento text,
  p_bairro      text,
  p_cidade      text,
  p_estado      text
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from auth.users a
    where a.id = p_auth_id
      and lower(a.email) = lower(trim(p_email))
      and (a.id = auth.uid() or a.created_at > now() - interval '1 hour')
  ) then
    raise exception 'Conta de autenticação inválida para criar o perfil'
      using errcode = '42501';
  end if;

  if exists (select 1 from public.users where auth_id = p_auth_id) then
    raise exception 'Já existe um perfil para esta conta' using errcode = '42501';
  end if;

  insert into public.users (
    auth_id, "fullName", email, cpf, "birthDate", phone, gender,
    cep, rua, numero, complemento, bairro, cidade, estado
  ) values (
    p_auth_id, p_full_name, lower(trim(p_email)), p_cpf, p_birth_date, p_phone, p_gender,
    p_cep, p_rua, p_numero, p_complemento, p_bairro, p_cidade, p_estado
  );
end;
$$;
revoke all on function public.criar_perfil_cadastro(uuid, text, text, text, date, text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.criar_perfil_cadastro(uuid, text, text, text, date, text, text, text, text, text, text, text, text, text)
  to anon, authenticated;

-- Remove conta de autenticação abandonada (sem perfil). Agora só apaga
-- contas que ainda NÃO confirmaram o e-mail, para que ninguém consiga apagar
-- a conta de outra pessoa que já confirmou e só não terminou o perfil.
create or replace function public.cleanup_orphaned_auth_user(p_email text)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select au.id into v_user_id
  from auth.users au
  where au.email = p_email
    and au.email_confirmed_at is null
    and not exists (select 1 from public.users pu where pu.auth_id = au.id);

  if v_user_id is not null then
    delete from auth.users where id = v_user_id;
    return true;
  end if;
  return false;
end;
$$;
revoke all on function public.cleanup_orphaned_auth_user(text) from public, anon, authenticated;
grant execute on function public.cleanup_orphaned_auth_user(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. Funções administrativas: exigem administrador
-- -----------------------------------------------------------------------------
create or replace function public.admin_delete_item(p_iditem integer)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_sol_ids   int[];
  v_trans_ids int[];
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito a administradores' using errcode = '42501';
  end if;

  select array_agg(idsolicitacao) into v_sol_ids
  from public.solicitacao_aluguel where iditem = p_iditem;

  select array_agg(idtransacao) into v_trans_ids
  from public.transacao_aluguel where iditem = p_iditem;

  if v_trans_ids is not null then
    delete from public.pagamento where idtransacao = any(v_trans_ids);
  end if;
  delete from public.transacao_aluguel where iditem = p_iditem;
  if v_sol_ids is not null then
    delete from public.mensagem_chat where idsolicitacao = any(v_sol_ids);
    delete from public.mensagem      where idsolicitacao = any(v_sol_ids);
  end if;
  delete from public.solicitacao_aluguel where iditem = p_iditem;
  delete from public.fotoitem where iditem = p_iditem;
  delete from public.item     where iditem = p_iditem;
  return true;
end;
$$;

create or replace function public.admin_delete_user(p_iduser bigint)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_auth_id uuid;
  v_item_id int;
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito a administradores' using errcode = '42501';
  end if;

  select auth_id into v_auth_id from public.users where id = p_iduser;

  if v_auth_id is not null then
    for v_item_id in (select iditem from public.item where idlocador = v_auth_id) loop
      perform public.admin_delete_item(v_item_id);
    end loop;
  end if;

  delete from public.avaliacao      where idavaliador = p_iduser or idavaliado = p_iduser;
  delete from public.ticket_suporte where idusuario = p_iduser;
  delete from public.notificacao    where idusuario = p_iduser;
  delete from public.pagamento      where idlocatario = p_iduser;
  delete from public.transacao_aluguel where idlocador = p_iduser or idlocatario = p_iduser;
  delete from public.mensagem_chat  where idremetente = p_iduser or iddestinatario = p_iduser;
  delete from public.mensagem
   where idsolicitacao in (select idsolicitacao from public.solicitacao_aluguel
                           where idlocador = p_iduser or idlocatario = p_iduser);
  delete from public.solicitacao_aluguel where idlocador = p_iduser or idlocatario = p_iduser;
  delete from public.users where id = p_iduser;
  return true;
end;
$$;

create or replace function public.admin_delete_avaliacao(p_idavaliacao integer)
returns boolean
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito a administradores' using errcode = '42501';
  end if;
  delete from public.avaliacao where idavaliacao = p_idavaliacao;
  return true;
end;
$$;

revoke all on function public.admin_delete_item(integer)      from public, anon, authenticated;
revoke all on function public.admin_delete_user(bigint)        from public, anon, authenticated;
revoke all on function public.admin_delete_avaliacao(integer)  from public, anon, authenticated;
grant execute on function public.admin_delete_item(integer)     to authenticated;
grant execute on function public.admin_delete_user(bigint)       to authenticated;
grant execute on function public.admin_delete_avaliacao(integer) to authenticated;

-- Exclusão da própria conta: só a versão com senha fica disponível.
-- A versão sem parâmetro não verifica senha e não é usada pelo app.
revoke all on function public.delete_user_account()     from public, anon, authenticated;
revoke all on function public.delete_user_account(text) from public, anon, authenticated;
grant execute on function public.delete_user_account(text) to authenticated;
alter function public.delete_user_account(text) set search_path = public, extensions;
alter function public.delete_user_account()     set search_path = public, extensions;

-- Funções de gatilho: search_path fixo
alter function public.fn_atualiza_disponivel_item()      set search_path = public;
alter function public.sync_user_email_on_auth_change()   set search_path = public;

-- -----------------------------------------------------------------------------
-- 7. Catálogo: item, fotoitem, categoria, avaliacao
-- -----------------------------------------------------------------------------
create policy item_select_publico on public.item
  for select to anon, authenticated using (true);
create policy item_insert_dono on public.item
  for insert to authenticated with check (idlocador = (select auth.uid()));
create policy item_update_dono on public.item
  for update to authenticated
  using (idlocador = (select auth.uid())) with check (idlocador = (select auth.uid()));
create policy item_delete_dono on public.item
  for delete to authenticated using (idlocador = (select auth.uid()));
create policy item_update_admin on public.item
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy item_delete_admin on public.item
  for delete to authenticated using ((select public.is_admin()));

create policy fotoitem_select_publico on public.fotoitem
  for select to anon, authenticated using (true);
create policy fotoitem_insert_dono on public.fotoitem
  for insert to authenticated
  with check (exists (select 1 from public.item i
                      where i.iditem = fotoitem.iditem and i.idlocador = (select auth.uid())));
create policy fotoitem_update_dono on public.fotoitem
  for update to authenticated
  using (exists (select 1 from public.item i
                 where i.iditem = fotoitem.iditem and i.idlocador = (select auth.uid())))
  with check (exists (select 1 from public.item i
                      where i.iditem = fotoitem.iditem and i.idlocador = (select auth.uid())));
create policy fotoitem_delete_dono on public.fotoitem
  for delete to authenticated
  using (exists (select 1 from public.item i
                 where i.iditem = fotoitem.iditem and i.idlocador = (select auth.uid())));
create policy fotoitem_delete_admin on public.fotoitem
  for delete to authenticated using ((select public.is_admin()));

create policy categoria_select_publico on public.categoria
  for select to anon, authenticated using (true);

create policy avaliacao_select_publico on public.avaliacao
  for select to anon, authenticated using (true);
create policy avaliacao_delete_admin on public.avaliacao
  for delete to authenticated using ((select public.is_admin()));
-- INSERT de avaliação fica para a issue #17 (regras de integridade).

-- -----------------------------------------------------------------------------
-- 8. Aluguel: solicitacao_aluguel, mensagem, mensagem_chat, transacao_aluguel
-- -----------------------------------------------------------------------------
create policy solicitacao_select_participante on public.solicitacao_aluguel
  for select to authenticated
  using (idlocador = (select public.meu_usuario_id()) or idlocatario = (select public.meu_usuario_id()));
create policy solicitacao_select_admin on public.solicitacao_aluguel
  for select to authenticated using ((select public.is_admin()));

-- Locatário cria o pedido para o dono real do item, sempre como 'pendente'
create policy solicitacao_insert_locatario on public.solicitacao_aluguel
  for insert to authenticated
  with check (
    idlocatario = (select public.meu_usuario_id())
    and idlocador = public.dono_do_item(iditem)
    and idlocador <> idlocatario
    and status = 'pendente'
  );

create policy solicitacao_update_participante on public.solicitacao_aluguel
  for update to authenticated
  using (idlocador = (select public.meu_usuario_id()) or idlocatario = (select public.meu_usuario_id()))
  with check (idlocador = (select public.meu_usuario_id()) or idlocatario = (select public.meu_usuario_id()));

create policy solicitacao_delete_locador on public.solicitacao_aluguel
  for delete to authenticated using (idlocador = (select public.meu_usuario_id()));
create policy solicitacao_delete_admin on public.solicitacao_aluguel
  for delete to authenticated using ((select public.is_admin()));

-- Participantes não podem trocar item, locador ou locatário de uma solicitação
create or replace function public.fn_solicitacao_protege_colunas()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.idsolicitacao is distinct from old.idsolicitacao
       or new.iditem      is distinct from old.iditem
       or new.idlocador   is distinct from old.idlocador
       or new.idlocatario is distinct from old.idlocatario then
      raise exception 'Não é permitido alterar item, locador ou locatário da solicitação'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_solicitacao_protege_colunas on public.solicitacao_aluguel;
create trigger trg_solicitacao_protege_colunas
  before update on public.solicitacao_aluguel
  for each row execute function public.fn_solicitacao_protege_colunas();

create policy mensagem_select_participante on public.mensagem
  for select to authenticated
  using (exists (select 1 from public.solicitacao_aluguel s
                 where s.idsolicitacao = mensagem.idsolicitacao
                   and (s.idlocador = (select public.meu_usuario_id())
                        or s.idlocatario = (select public.meu_usuario_id()))));
create policy mensagem_insert_participante on public.mensagem
  for insert to authenticated
  with check (
    idremetente = (select public.meu_usuario_id())
    and exists (select 1 from public.solicitacao_aluguel s
                where s.idsolicitacao = mensagem.idsolicitacao
                  and (s.idlocador = (select public.meu_usuario_id())
                       or s.idlocatario = (select public.meu_usuario_id())))
  );
create policy mensagem_delete_participante on public.mensagem
  for delete to authenticated
  using (exists (select 1 from public.solicitacao_aluguel s
                 where s.idsolicitacao = mensagem.idsolicitacao
                   and (s.idlocador = (select public.meu_usuario_id())
                        or s.idlocatario = (select public.meu_usuario_id()))));
create policy mensagem_delete_admin on public.mensagem
  for delete to authenticated using ((select public.is_admin()));

-- Tabela legada (o chat atual usa "mensagem")
create policy mensagem_chat_select_participante on public.mensagem_chat
  for select to authenticated
  using (idremetente = (select public.meu_usuario_id()) or iddestinatario = (select public.meu_usuario_id()));
create policy mensagem_chat_select_admin on public.mensagem_chat
  for select to authenticated using ((select public.is_admin()));
create policy mensagem_chat_delete_admin on public.mensagem_chat
  for delete to authenticated using ((select public.is_admin()));

create policy transacao_select_participante on public.transacao_aluguel
  for select to authenticated
  using (idlocador = (select public.meu_usuario_id()) or idlocatario = (select public.meu_usuario_id()));
create policy transacao_select_admin on public.transacao_aluguel
  for select to authenticated using ((select public.is_admin()));
create policy transacao_delete_admin on public.transacao_aluguel
  for delete to authenticated using ((select public.is_admin()));

-- pagamento, notificacao e ticket_suporte: RLS ligada e sem políticas
-- (fechadas para o cliente) até as features de pagamento/notificação/suporte
-- serem implementadas. As funções administrativas continuam podendo apagá-las.

-- -----------------------------------------------------------------------------
-- 9. Storage
-- -----------------------------------------------------------------------------
-- Bucket items (fotos de anúncios e fotos de entrega/recebimento): leitura
-- pública continua pela política "Public read"; upload só com login.
create policy items_upload_autenticado on storage.objects
  for insert to authenticated
  with check (bucket_id = 'items');

-- Bucket avatars: arquivo "<auth_id>.<ext>" (EditarPerfil.tsx); cada usuário
-- só envia ou substitui o próprio avatar.
create policy avatars_insert_proprio on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and split_part(name, '.', 1) = (select auth.uid())::text);
create policy avatars_update_proprio on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and split_part(name, '.', 1) = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and split_part(name, '.', 1) = (select auth.uid())::text);

commit;
