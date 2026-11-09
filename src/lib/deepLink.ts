// ─── Deep links do app Android (Capacitor) ───────────────────────────────────
// Links de e-mail do Supabase (confirmação de cadastro, redefinição de senha) e o
// retorno do login com Google precisam voltar para o app, e não para
// http://localhost (origem da WebView). No Android usamos o esquema próprio
// com.alugapp.app://auth-callback, registrado no AndroidManifest.xml e na
// allowlist de Redirect URLs do Supabase (ver mobile/README.md e ADR 0001).
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { supabase } from './supabaseClient';

export const NATIVE_AUTH_CALLBACK = 'com.alugapp.app://auth-callback';

export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

/** URL de retorno do login com Google (web: REACT_APP_SITE_URL ou a origem atual). */
export function oauthRedirectUrl(native: boolean = isNativeApp()): string {
  if (native) return NATIVE_AUTH_CALLBACK;
  return process.env.REACT_APP_SITE_URL || window.location.origin;
}

/** URL de retorno dos links enviados por e-mail (confirmação de cadastro, redefinição de senha). */
export function emailRedirectUrl(native: boolean = isNativeApp()): string {
  if (native) return NATIVE_AUTH_CALLBACK;
  return window.location.origin;
}

export interface AuthCallback {
  accessToken?: string;
  refreshToken?: string;
  /** signup | recovery | magiclink | invite | email_change */
  type?: string;
  /** fluxo PKCE */
  code?: string;
  error?: string;
  errorDescription?: string;
}

/**
 * Extrai os parâmetros de autenticação de uma URL de retorno do Supabase,
 * tanto no fragmento (#access_token=..., fluxo implícito) quanto na query (?code=..., PKCE).
 * Retorna null se a URL não for um retorno de autenticação.
 */
export function parseAuthCallback(url: string): AuthCallback | null {
  if (!url) return null;
  const hashIdx = url.indexOf('#');
  const qIdx = url.indexOf('?');
  const query = qIdx >= 0 ? url.slice(qIdx + 1, hashIdx > qIdx ? hashIdx : undefined) : '';
  const hash = hashIdx >= 0 ? url.slice(hashIdx + 1) : '';
  const params = new URLSearchParams(query);
  new URLSearchParams(hash).forEach((v, k) => params.set(k, v));

  const r: AuthCallback = {
    accessToken: params.get('access_token') || undefined,
    refreshToken: params.get('refresh_token') || undefined,
    type: params.get('type') || undefined,
    code: params.get('code') || undefined,
    error: params.get('error_code') || params.get('error') || undefined,
    errorDescription: params.get('error_description')?.replace(/\+/g, ' ') || undefined,
  };
  if (!r.accessToken && !r.code && !r.error) return null;
  return r;
}

export interface DeepLinkHandlers {
  /** Chamado antes de restaurar a sessão quando o link é de redefinição de senha. */
  onRecovery: () => void;
  /** Chamado com uma mensagem amigável quando o link é inválido/expirado. */
  onError: (message: string) => void;
}

export function mensagemErroLink(cb: AuthCallback): string {
  if (cb.error === 'otp_expired') return 'Este link expirou ou já foi usado. Solicite um novo e-mail.';
  return cb.errorDescription || 'Não foi possível validar o link. Tente novamente.';
}

/** Restaura a sessão a partir da URL recebida pelo app. Retorna true se tratou a URL. */
export async function handleAuthCallbackUrl(url: string, handlers: DeepLinkHandlers): Promise<boolean> {
  const cb = parseAuthCallback(url);
  if (!cb) return false;

  if (cb.error) {
    handlers.onError(mensagemErroLink(cb));
    return true;
  }
  if (cb.type === 'recovery') handlers.onRecovery();

  const { error } = cb.code
    ? await supabase.auth.exchangeCodeForSession(cb.code)
    : await supabase.auth.setSession({ access_token: cb.accessToken!, refresh_token: cb.refreshToken || '' });

  if (error) handlers.onError(mensagemErroLink({ errorDescription: error.message }));
  return true;
}

/**
 * Registra o tratamento de deep links (app aberto a partir do link, a frio ou em segundo plano).
 * Na web não faz nada: o próprio supabase-js lê a URL (detectSessionInUrl).
 */
export function initDeepLinks(handlers: DeepLinkHandlers): () => void {
  if (!isNativeApp()) return () => undefined;

  let ativo = true;
  const listener = App.addListener('appUrlOpen', ({ url }) => {
    if (ativo) handleAuthCallbackUrl(url, handlers);
  });
  App.getLaunchUrl().then((launch) => {
    if (ativo && launch?.url) handleAuthCallbackUrl(launch.url, handlers);
  });

  return () => {
    ativo = false;
    listener.then((l) => l.remove());
  };
}
