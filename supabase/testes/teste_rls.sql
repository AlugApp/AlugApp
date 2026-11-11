-- =============================================================================
-- Teste das políticas RLS (issue #12)
-- =============================================================================
-- Rodar no Supabase: SQL Editor > New query > colar tudo > Run.
-- Simula três papéis com os mesmos mecanismos da API (role + JWT):
--   * visitante (anon)
--   * usuário A (logado, não administrador) tentando ler/alterar dados de B
--   * administrador
-- Toda tentativa de escrita roda dentro de um sub-bloco que é sempre desfeito,
-- então o teste não altera nenhum dado, mesmo que alguma política falhe.
-- Resultado: tabela com uma linha por teste (OK / FALHOU).
-- Pré-requisito: pelo menos 2 perfis com auth_id, sendo 1 deles não admin.
-- =============================================================================

create temp table if not exists resultado_rls (
  ordem int, papel text, teste text, esperado text, obtido text, situacao text
);
truncate resultado_rls;

do $$
declare
  a_id bigint; a_auth uuid; a_email text;
  b_id bigint; b_auth uuid;
  adm_email text; adm_auth uuid;
  total_users bigint;
  n bigint;
  r text[] := '{}';

begin
  -- ---------------------------------------------------------------- preparação
  select u.id, u.auth_id, u.email into a_id, a_auth, a_email
  from public.users u
  where u.auth_id is not null
    and not exists (select 1 from public.admins ad where ad.email = lower(u.email))
  order by u.id limit 1;

  select u.id, u.auth_id into b_id, b_auth
  from public.users u
  where u.auth_id is not null and u.id <> a_id
  order by u.id limit 1;

  select ad.email, au.id into adm_email, adm_auth
  from public.admins ad left join auth.users au on lower(au.email) = ad.email
  order by ad.email limit 1;

  select count(*) into total_users from public.users;

  if a_id is null or b_id is null then
    raise exception 'São necessários 2 perfis com auth_id (1 não admin) para o teste';
  end if;

  -- ================================================================ VISITANTE
  perform set_config('request.jwt.claims', '{"role":"anon"}', false);
  perform set_config('request.jwt.claim.sub', '', false);
  set role anon;

  begin
    select count(*) into n from public.users;
    r := r || array['anon', 'Ler tabela users', 'bloqueado', 'leu ' || n || ' linhas'];
  exception when insufficient_privilege then
    r := r || array['anon', 'Ler tabela users', 'bloqueado', 'bloqueado'];
  end;

  select count(*) into n from public.perfil_publico;
  r := r || array['anon', 'Ler perfil_publico (nome e foto)', 'permitido',
                  case when n > 0 then 'permitido' else 'vazio' end];

  begin
    select count(*) into n from public.item;
    r := r || array['anon', 'Ler anúncios (item)', 'permitido', 'permitido'];
  exception when insufficient_privilege then
    r := r || array['anon', 'Ler anúncios (item)', 'permitido', 'bloqueado'];
  end;

  begin
    select count(*) into n from public.solicitacao_aluguel;
    r := r || array['anon', 'Ler solicitações', 'bloqueado', 'leu ' || n || ' linhas'];
  exception when insufficient_privilege then
    r := r || array['anon', 'Ler solicitações', 'bloqueado', 'bloqueado'];
  end;

  begin
    select count(*) into n from public.transacao_aluguel;
    r := r || array['anon', 'Ler transações', 'bloqueado', 'leu ' || n || ' linhas'];
  exception when insufficient_privilege then
    r := r || array['anon', 'Ler transações', 'bloqueado', 'bloqueado'];
  end;

  begin
    perform public.cadastro_existe('nao-existe@exemplo.invalid', null, null);
    r := r || array['anon', 'Checar e-mail no cadastro (cadastro_existe)', 'permitido', 'permitido'];
  exception when others then
    r := r || array['anon', 'Checar e-mail no cadastro (cadastro_existe)', 'permitido', 'erro: ' || sqlerrm];
  end;

  begin
    begin
      perform public.admin_delete_item(-1);
      raise exception using errcode = 'P0001', message = 'executou';
    end;
  exception
    when insufficient_privilege then
      r := r || array['anon', 'Executar admin_delete_item', 'bloqueado', 'bloqueado'];
    when sqlstate 'P0001' then
      r := r || array['anon', 'Executar admin_delete_item', 'bloqueado', 'executou'];
  end;

  begin
    begin
      insert into public.item (nome, idlocador) values ('teste rls', b_auth);
      raise exception using errcode = 'P0001', message = 'inseriu';
    end;
  exception
    when insufficient_privilege then
      r := r || array['anon', 'Criar anúncio', 'bloqueado', 'bloqueado'];
    when sqlstate 'P0001' then
      r := r || array['anon', 'Criar anúncio', 'bloqueado', 'inseriu'];
  end;

  reset role;

  -- ================================================================ USUÁRIO A
  perform set_config('request.jwt.claims',
    json_build_object('sub', a_auth, 'role', 'authenticated', 'email', a_email)::text, false);
  perform set_config('request.jwt.claim.sub', a_auth::text, false);
  set role authenticated;

  select count(*) into n from public.users;
  r := r || array['usuário A', 'Linhas visíveis em users (só a própria)', '1', n::text];

  select count(*) into n from public.users where id = b_id;
  r := r || array['usuário A', 'Ler perfil completo de B', '0', n::text];

  select count(*) into n from public.perfil_publico where id = b_id;
  r := r || array['usuário A', 'Ler nome/foto de B (perfil_publico)', '1', n::text];

  begin
    begin
      update public.users set "fullName" = "fullName" || ' (teste)' where id = b_id;
      get diagnostics n = row_count;
      raise exception using errcode = 'P0001', message = n::text;
    end;
  exception when sqlstate 'P0001' then
    r := r || array['usuário A', 'Editar perfil de B', '0 linhas', sqlerrm || ' linhas'];
  end;

  begin
    begin
      delete from public.users where id = b_id;
      get diagnostics n = row_count;
      raise exception using errcode = 'P0001', message = n::text;
    end;
  exception when sqlstate 'P0001' then
    r := r || array['usuário A', 'Apagar perfil de B', '0 linhas', sqlerrm || ' linhas'];
  end;

  begin
    begin
      update public.users set email = 'trocado@exemplo.invalid' where id = a_id;
      raise exception using errcode = 'P0001', message = 'alterou';
    end;
  exception
    when insufficient_privilege then
      r := r || array['usuário A', 'Trocar o próprio e-mail direto na tabela', 'bloqueado', 'bloqueado'];
    when sqlstate 'P0001' then
      r := r || array['usuário A', 'Trocar o próprio e-mail direto na tabela', 'bloqueado', 'alterou'];
  end;

  begin
    begin
      update public.users set "fullName" = "fullName" where id = a_id;
      get diagnostics n = row_count;
      raise exception using errcode = 'P0001', message = n::text;
    end;
  exception when sqlstate 'P0001' then
    r := r || array['usuário A', 'Editar o próprio perfil', '1 linhas', sqlerrm || ' linhas'];
  end;

  select count(*) into n from public.solicitacao_aluguel
  where idlocador <> a_id and idlocatario <> a_id;
  r := r || array['usuário A', 'Ver solicitações de outras pessoas', '0', n::text];

  select count(*) into n from public.transacao_aluguel
  where coalesce(idlocador, -1) <> a_id and coalesce(idlocatario, -1) <> a_id;
  r := r || array['usuário A', 'Ver transações de outras pessoas', '0', n::text];

  select count(*) into n from public.mensagem m
  where not exists (select 1 from public.solicitacao_aluguel s
                    where s.idsolicitacao = m.idsolicitacao
                      and (s.idlocador = a_id or s.idlocatario = a_id));
  r := r || array['usuário A', 'Ver mensagens de outras conversas', '0', n::text];

  begin
    begin
      update public.item set nome = nome where idlocador <> a_auth;
      get diagnostics n = row_count;
      raise exception using errcode = 'P0001', message = n::text;
    end;
  exception when sqlstate 'P0001' then
    r := r || array['usuário A', 'Editar anúncios de outras pessoas', '0 linhas', sqlerrm || ' linhas'];
  end;

  begin
    begin
      perform public.admin_delete_user(b_id);
      raise exception using errcode = 'P0001', message = 'executou';
    end;
  exception
    when insufficient_privilege then
      r := r || array['usuário A', 'Apagar usuário B via admin_delete_user', 'bloqueado', 'bloqueado'];
    when sqlstate 'P0001' then
      r := r || array['usuário A', 'Apagar usuário B via admin_delete_user', 'bloqueado', 'executou'];
  end;

  r := r || array['usuário A', 'is_admin()', 'false', public.is_admin()::text];

  reset role;

  -- ================================================================ ADMIN
  if adm_email is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', coalesce(adm_auth, gen_random_uuid()), 'role', 'authenticated',
                        'email', adm_email)::text, false);
    perform set_config('request.jwt.claim.sub', coalesce(adm_auth, gen_random_uuid())::text, false);
    set role authenticated;

    r := r || array['admin', 'is_admin()', 'true', public.is_admin()::text];

    select count(*) into n from public.users;
    r := r || array['admin', 'Linhas visíveis em users', total_users::text, n::text];

    reset role;
  end if;

  perform set_config('request.jwt.claims', '', false);
  perform set_config('request.jwt.claim.sub', '', false);

  -- ------------------------------------------------------------- resultado
  for i in 1 .. array_length(r, 1) / 4 loop
    insert into resultado_rls values (
      i, r[(i - 1) * 4 + 1], r[(i - 1) * 4 + 2], r[(i - 1) * 4 + 3], r[(i - 1) * 4 + 4],
      case when r[(i - 1) * 4 + 3] = r[(i - 1) * 4 + 4] then 'OK' else 'FALHOU' end
    );
  end loop;
exception when others then
  reset role;
  raise;
end $$;

select papel, teste, esperado, obtido, situacao
from resultado_rls
order by ordem;
