import { supabase } from './supabaseClient';
import { User } from '@supabase/supabase-js';
import { UserProfile } from '../contexts/AuthContext';

import revokedAdminsData from '../config/revoked_admins.json';

// Lista de e-mails de administradores autorizados por padrão
const DEFAULT_ADMIN_EMAILS: string[] = [
  'mateusjoaquim10@gmail.com',
  'lucascarmonab@gmail.com',
  'paniaguacaua@gmail.com',
  'pedro.martins@firstdecision.com.br',
];

const PROMOTED_ADMINS_KEY = 'alugapp_promoted_admins';
const REVOKED_ADMINS_KEY = 'alugapp_revoked_admins';

/**
 * Recupera os e-mails de administradores cuja permissão foi revogada (via script ou ação)
 */
export function getRevokedAdmins(): string[] {
  let localRevoked: string[] = [];
  try {
    const raw = localStorage.getItem(REVOKED_ADMINS_KEY);
    localRevoked = raw ? JSON.parse(raw) : [];
  } catch {
    localRevoked = [];
  }

  const fileRevoked: string[] = Array.isArray(revokedAdminsData) ? (revokedAdminsData as string[]) : [];
  const merged = [...fileRevoked, ...localRevoked].map((e) => e.trim().toLowerCase());
  return Array.from(new Set(merged));
}

/**
 * Verifica se o e-mail teve o papel de admin revogado
 */
export function isRevokedAdmin(email?: string | null): boolean {
  if (!email) return false;
  return getRevokedAdmins().includes(email.trim().toLowerCase());
}

/**
 * Recupera os e-mails de administradores promovidos dinamicamente
 */
export function getPromotedAdmins(): string[] {
  try {
    const raw = localStorage.getItem(PROMOTED_ADMINS_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const revoked = getRevokedAdmins();
    const filtered = list.filter((e) => !revoked.includes(e.toLowerCase()));
    if (filtered.length !== list.length) {
      localStorage.setItem(PROMOTED_ADMINS_KEY, JSON.stringify(filtered));
    }
    return filtered;
  } catch {
    return [];
  }
}

/**
 * Obtém a lista completa de e-mails com privilégios de administrador (filtrando revogados)
 */
export function getAdminEmails(): string[] {
  const envEmails = process.env.REACT_APP_ADMIN_EMAILS
    ? process.env.REACT_APP_ADMIN_EMAILS.split(',').map((e) => e.trim().toLowerCase())
    : [];

  const promoted = getPromotedAdmins().map((e) => e.toLowerCase());
  const revoked = getRevokedAdmins();

  const all = [...DEFAULT_ADMIN_EMAILS, ...envEmails, ...promoted];
  return Array.from(new Set(all.map((e) => e.toLowerCase()))).filter((e) => !revoked.includes(e));
}

/**
 * Promove um usuário a Administrador do sistema
 */
export async function promoteToAdmin(target: {
  id?: number;
  auth_id?: string;
  email: string;
  fullName?: string;
}): Promise<{ success: boolean; message: string }> {
  const email = target.email.trim().toLowerCase();
  const promoted = getPromotedAdmins();

  if (!promoted.includes(email)) {
    promoted.push(email);
  }
  localStorage.setItem(PROMOTED_ADMINS_KEY, JSON.stringify(promoted));

  // Remove da lista de revogados caso estivesse lá, restaurando a promoção
  try {
    const localRevoked = getRevokedAdmins().filter((e) => e !== email);
    localStorage.setItem(REVOKED_ADMINS_KEY, JSON.stringify(localRevoked));
  } catch {
    // Ignora erro de storage
  }

  // Tenta atualizar no banco se a coluna role ou is_admin existir
  try {
    await supabase.from('users').update({ role: 'admin', is_admin: true } as any).eq('email', email);
  } catch {
    // Ignora se schema ainda não tiver a coluna
  }

  return {
    success: true,
    message: `Usuário ${target.fullName || email} promovido a Administrador com sucesso.`,
  };
}

/**
 * Revoga privilégios de administrador de um usuário promovido
 */
export async function demoteAdmin(target: {
  email: string;
  fullName?: string;
}): Promise<{ success: boolean; message: string }> {
  const email = target.email.trim().toLowerCase();
  let promoted = getPromotedAdmins();

  promoted = promoted.filter((e) => e.toLowerCase() !== email);
  localStorage.setItem(PROMOTED_ADMINS_KEY, JSON.stringify(promoted));

  // Adiciona aos revogados
  try {
    const localRevoked = getRevokedAdmins();
    if (!localRevoked.includes(email)) {
      localRevoked.push(email);
      localStorage.setItem(REVOKED_ADMINS_KEY, JSON.stringify(localRevoked));
    }
  } catch {
    // Ignora erro de storage
  }

  try {
    await supabase.from('users').update({ role: 'user', is_admin: false } as any).eq('email', email);
  } catch {
    // Ignora se schema ainda não tiver a coluna
  }

  return {
    success: true,
    message: `Privilégios de administrador de ${target.fullName || email} revogados.`,
  };
}

/**
 * Verifica se um usuário possui papel de administrador (RBAC).
 * Checa metadados do Supabase Auth, perfil do banco e lista autorizada.
 */
export function isAdmin(
  user?: Partial<User> | null,
  profile?: Partial<UserProfile> | null
): boolean {
  if (!user && !profile) return false;

  const email = (user?.email || profile?.email || '').trim().toLowerCase();

  // Se o usuário teve a permissão revogada via script ou ação administrativa, nega imediatamente
  if (email && isRevokedAdmin(email)) {
    return false;
  }

  // 1. Verifica app_metadata ou user_metadata do Supabase Auth
  const appRole = (user?.app_metadata as any)?.role;
  const userRole = (user?.user_metadata as any)?.role;
  if (appRole === 'admin' || userRole === 'admin') return true;

  // 2. Verifica propriedades no perfil se existirem
  if (profile?.role === 'admin' || profile?.is_admin === true) return true;

  // 3. Verifica correspondência por e-mail na lista autorizada
  if (email && getAdminEmails().includes(email)) return true;

  return false;
}

// ─── Moderação de Usuários (Banimento) ──────────────────────────────────────────

const BANNED_STORAGE_KEY = 'alugapp_banned_identifiers';

/**
 * Recupera a lista de identificadores banidos (e-mails ou IDs)
 */
export function getBannedIdentifiers(): string[] {
  try {
    const raw = localStorage.getItem(BANNED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Verifica se o usuário atual está banido
 */
export function isUserBanned(emailOrId?: string | number | null): boolean {
  if (!emailOrId) return false;
  const val = String(emailOrId).trim().toLowerCase();
  const bannedList = getBannedIdentifiers();
  return bannedList.includes(val);
}

/**
 * Bane um usuário.
 * REGRA ESTRITA DE PROTEÇÃO: É estritamente proibido banir contas de administradores.
 */
export async function banUser(target: {
  id?: number;
  auth_id?: string;
  email: string;
  fullName?: string;
}): Promise<{ success: boolean; message: string }> {
  const email = target.email.trim().toLowerCase();

  // Trava de segurança: Proibido banir admin
  if (isAdmin({ email }, { email })) {
    return {
      success: false,
      message: 'Ação não permitida: Não é possível banir um usuário administrador.',
    };
  }

  const bannedList = getBannedIdentifiers();
  if (!bannedList.includes(email)) {
    bannedList.push(email);
  }
  if (target.id && !bannedList.includes(String(target.id))) {
    bannedList.push(String(target.id));
  }
  if (target.auth_id && !bannedList.includes(target.auth_id)) {
    bannedList.push(target.auth_id);
  }

  localStorage.setItem(BANNED_STORAGE_KEY, JSON.stringify(bannedList));

  // Opcional: tenta salvar no banco se a coluna existir (fail-safe)
  try {
    await supabase.from('users').update({ is_banned: true } as any).eq('email', email);
  } catch {
    // Ignora caso a coluna não exista no schema atual
  }

  return { success: true, message: `Usuário ${target.fullName || email} banido com sucesso.` };
}

/**
 * Remove o banimento de um usuário
 */
export async function unbanUser(target: {
  id?: number;
  auth_id?: string;
  email: string;
}): Promise<{ success: boolean; message: string }> {
  const email = target.email.trim().toLowerCase();
  let bannedList = getBannedIdentifiers();

  bannedList = bannedList.filter(
    (item) =>
      item !== email &&
      (!target.id || item !== String(target.id)) &&
      (!target.auth_id || item !== target.auth_id)
  );

  localStorage.setItem(BANNED_STORAGE_KEY, JSON.stringify(bannedList));

  // Tenta sincronizar com o banco se aplicável
  try {
    await supabase.from('users').update({ is_banned: false } as any).eq('email', email);
  } catch {
    // Ignora se coluna não existir
  }

  return { success: true, message: `Banimento de ${email} revogado com sucesso.` };
}

// ─── Moderação de Anúncios ───────────────────────────────────────────────────

/**
 * Exclusão forçada de anúncio com remoção cascateada de integridade referencial.
 * Permite a administradores remover qualquer anúncio na plataforma.
 */
export async function forceDeleteItem(iditem: number): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Busca solicitações atreladas ao item
    const { data: solicitacoes } = await supabase
      .from('solicitacao_aluguel')
      .select('idsolicitacao')
      .eq('iditem', iditem);

    if (solicitacoes && solicitacoes.length > 0) {
      const solIds = solicitacoes.map((s) => s.idsolicitacao);

      // 1.1 Apaga mensagens de chat
      const { error: msgErr } = await supabase
        .from('mensagem')
        .delete()
        .in('idsolicitacao', solIds);
      if (msgErr) console.warn('[Admin] Aviso ao remover mensagens:', msgErr.message);

      // 1.2 Apaga as solicitações
      const { error: solErr } = await supabase
        .from('solicitacao_aluguel')
        .delete()
        .eq('iditem', iditem);
      if (solErr) console.warn('[Admin] Aviso ao remover solicitações:', solErr.message);
    }

    // 2. Apaga fotos da tabela fotoitem
    const { error: photoErr } = await supabase
      .from('fotoitem')
      .delete()
      .eq('iditem', iditem);
    if (photoErr) console.warn('[Admin] Aviso ao remover fotos:', photoErr.message);

    // 3. Exclui o item
    const { error: itemErr } = await supabase
      .from('item')
      .delete()
      .eq('iditem', iditem);

    if (itemErr) {
      return { success: false, message: `Erro ao excluir anúncio: ${itemErr.message}` };
    }

    // Valida se o item realmente não existe mais
    const { data: check } = await supabase
      .from('item')
      .select('iditem')
      .eq('iditem', iditem)
      .maybeSingle();

    if (check) {
      return { success: false, message: 'Erro ao remover anúncio. Verifique as permissões de banco (RLS).' };
    }

    return { success: true, message: 'Anúncio removido com sucesso pela moderação.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Erro inesperado ao excluir anúncio.' };
  }
}

// ─── Gestão de Preços e Descontos ─────────────────────────────────────────────

/**
 * Atualização forçada de preços e aplicação/remoção de descontos
 */
export async function updateItemPricing(
  iditem: number,
  params: {
    diario: number;
    semana: number;
    mensal: number;
    desconto_percentual?: number | null;
  }
): Promise<{ success: boolean; message: string }> {
  try {
    const updatePayload: Record<string, any> = {
      valor_aluguel_diario: params.diario,
      valor_aluguel_semana: params.semana,
      valor_aluguel_mensal: params.mensal,
      desconto_percentual: params.desconto_percentual ?? null,
    };

    const { error } = await supabase
      .from('item')
      .update(updatePayload)
      .eq('iditem', iditem);

    if (error) {
      return { success: false, message: `Erro ao atualizar valores: ${error.message}` };
    }

    return { success: true, message: 'Preços e desconto atualizados com sucesso.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Erro inesperado ao atualizar preços.' };
  }
}
