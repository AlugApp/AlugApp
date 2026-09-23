import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { decrypt } from '../lib/crypto';
import { isAdmin as checkIsAdmin, isUserBanned } from '../lib/admin';

export interface UserProfile {
  id?: number;
  auth_id: string;
  fullName: string;
  email: string;
  cpf?: string;
  phone?: string;
  gender?: string;
  cep?: string;
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  birthDate?: string;
  avatar_url?: string;
  role?: string;
  is_admin?: boolean;
  is_banned?: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // loading só é true durante o carregamento inicial — nunca muda depois
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);
  const hasSessionRef = useRef(false);

  const cleanOAuthUrl = () => {
    if (
      typeof window !== 'undefined' &&
      (window.location.hash.includes('access_token=') || window.location.search.includes('code='))
    ) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const fetchProfile = async (authId: string) => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authId)
      .maybeSingle();
    if (data) {
      data.cpf = decrypt(data.cpf ?? '');
      // Verificação de banimento
      const banned = isUserBanned(data.email) || isUserBanned(data.id) || isUserBanned(data.auth_id) || data.is_banned;
      if (banned) {
        alert('Sua conta foi suspensa por decisão da moderação do AlugApp.');
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
        return;
      }
    }
    setProfile(data ?? null);
  };

  const refreshProfile = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) await fetchProfile(currentUser.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  useEffect(() => {
    // ── Inicialização: carrega sessão existente via getSession ─────────────────
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        cleanOAuthUrl();
        hasSessionRef.current = true;
        fetchProfile(s.user.id).finally(() => {
          initializedRef.current = true;
          setLoading(false);
        });
      } else {
        hasSessionRef.current = false;
        initializedRef.current = true;
        setLoading(false);
      }
    });

    // ── Escuta mudanças de estado ──────────────────────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      // Eventos de inicialização — já tratados pelo getSession acima, ignorar
      if (event === 'INITIAL_SESSION') return;

      // Renovação de token — atualiza sessão silenciosamente, sem tocar em loading
      if (event === 'TOKEN_REFRESHED') {
        setSession(s);
        return;
      }

      // Usuário deslogou — limpa tudo
      if (event === 'SIGNED_OUT') {
        initializedRef.current = false;
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      // SIGNED_IN redundante (já havia sessão ativa) — ignorar para não resetar telas
      // Se hasSessionRef = false, é login real e deve ser processado
      if (event === 'SIGNED_IN' && initializedRef.current && hasSessionRef.current) return;

      // Login real ou USER_UPDATED
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        cleanOAuthUrl();
        hasSessionRef.current = true;
        setLoading(true);
        fetchProfile(s.user.id).finally(() => {
          initializedRef.current = true;
          setLoading(false);
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const isUserAdmin = checkIsAdmin(user, profile);

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, isAdmin: isUserAdmin, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
