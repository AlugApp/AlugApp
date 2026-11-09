jest.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
jest.mock('@capacitor/app', () => ({ App: { addListener: () => undefined, getLaunchUrl: () => undefined } }));
jest.mock('../supabaseClient', () => ({
  supabase: { auth: { setSession: jest.fn(), exchangeCodeForSession: jest.fn() } },
}));

import {
  NATIVE_AUTH_CALLBACK,
  emailRedirectUrl,
  handleAuthCallbackUrl,
  oauthRedirectUrl,
  parseAuthCallback,
} from '../deepLink';
import { supabase } from '../supabaseClient';

const setSession = supabase.auth.setSession as jest.Mock;
const exchange = supabase.auth.exchangeCodeForSession as jest.Mock;

// RF009 / RF038 — links de e-mail e retorno do Google voltam ao app Android (issues #22–#24)
describe('Deep links de autenticação do app Android (RF009, RF038)', () => {
  test('[AUT-035] URLs de retorno usam o esquema nativo no app e a origem na web', () => {
    expect(NATIVE_AUTH_CALLBACK).toBe('com.alugapp.app://auth-callback');
    expect(emailRedirectUrl(true)).toBe(NATIVE_AUTH_CALLBACK);
    expect(oauthRedirectUrl(true)).toBe(NATIVE_AUTH_CALLBACK);
    expect(emailRedirectUrl(false)).toBe(window.location.origin);
    expect(oauthRedirectUrl(false)).toBe(process.env.REACT_APP_SITE_URL || window.location.origin);
  });

  test('[AUT-036] parseAuthCallback lê tokens do fragmento, código PKCE da query e erros', () => {
    expect(
      parseAuthCallback(`${NATIVE_AUTH_CALLBACK}#access_token=aaa&expires_in=3600&refresh_token=rrr&token_type=bearer&type=recovery`)
    ).toEqual({ accessToken: 'aaa', refreshToken: 'rrr', type: 'recovery' });
    expect(parseAuthCallback(`${NATIVE_AUTH_CALLBACK}?code=abc123`)).toEqual({ code: 'abc123' });
    expect(
      parseAuthCallback(`${NATIVE_AUTH_CALLBACK}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid`)
    ).toEqual({ error: 'otp_expired', errorDescription: 'Email link is invalid' });
    expect(parseAuthCallback(`${NATIVE_AUTH_CALLBACK}`)).toBeNull();
    expect(parseAuthCallback('https://alugapp.vercel.app/')).toBeNull();
    expect(parseAuthCallback('')).toBeNull();
  });

  test('[AUT-037] link de redefinição de senha restaura a sessão e abre a tela de nova senha', async () => {
    setSession.mockResolvedValue({ error: null });
    const onRecovery = jest.fn();
    const onError = jest.fn();
    const ok = await handleAuthCallbackUrl(
      `${NATIVE_AUTH_CALLBACK}#access_token=aaa&refresh_token=rrr&type=recovery`,
      { onRecovery, onError }
    );
    expect(ok).toBe(true);
    expect(onRecovery).toHaveBeenCalled();
    expect(setSession).toHaveBeenCalledWith({ access_token: 'aaa', refresh_token: 'rrr' });
    expect(onError).not.toHaveBeenCalled();
  });

  test('[AUT-038] confirmação de cadastro e PKCE restauram a sessão sem abrir a redefinição de senha', async () => {
    setSession.mockResolvedValue({ error: null });
    exchange.mockResolvedValue({ error: null });
    const onRecovery = jest.fn();
    await handleAuthCallbackUrl(`${NATIVE_AUTH_CALLBACK}#access_token=aaa&refresh_token=rrr&type=signup`, {
      onRecovery,
      onError: jest.fn(),
    });
    await handleAuthCallbackUrl(`${NATIVE_AUTH_CALLBACK}?code=abc123`, { onRecovery, onError: jest.fn() });
    expect(setSession).toHaveBeenCalledWith({ access_token: 'aaa', refresh_token: 'rrr' });
    expect(exchange).toHaveBeenCalledWith('abc123');
    expect(onRecovery).not.toHaveBeenCalled();
  });

  test('[AUT-039] link expirado ou sessão inválida avisam o usuário e não restauram a sessão', async () => {
    const onError = jest.fn();
    await handleAuthCallbackUrl(`${NATIVE_AUTH_CALLBACK}#error=access_denied&error_code=otp_expired`, {
      onRecovery: jest.fn(),
      onError,
    });
    expect(onError).toHaveBeenCalledWith('Este link expirou ou já foi usado. Solicite um novo e-mail.');
    expect(setSession).not.toHaveBeenCalled();

    setSession.mockResolvedValue({ error: { message: 'Invalid Refresh Token' } });
    await handleAuthCallbackUrl(`${NATIVE_AUTH_CALLBACK}#access_token=x&refresh_token=y`, {
      onRecovery: jest.fn(),
      onError,
    });
    expect(onError).toHaveBeenLastCalledWith('Invalid Refresh Token');
    expect(await handleAuthCallbackUrl('https://alugapp.vercel.app/', { onRecovery: jest.fn(), onError })).toBe(false);
  });
});
