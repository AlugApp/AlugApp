import React, { useEffect, useState, useCallback } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabaseClient';
import Home from './pages/Home';
import Login from './pages/Login';
import Cadastro from './pages/Cadastro';
import AnunciarItem from './pages/CadastrarItem';
import ItemDetalhes from './pages/DetalhesItem';
import Perfil from './pages/Perfil';
import EditarPerfil from './pages/EditarPerfil';
import RecuperarSenha from './pages/RecuperarSenha';
import RedefinirSenha from './pages/RedefinirSenha';
import MeusAnuncios from './pages/MeusAnuncios';
import EditarItem from './pages/EditarItem';
import CompletarPerfil from './pages/CompletarPerfil';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Admin from './pages/Admin';
import BottomNav from './components/BottomNav';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type AppMode = 'home' | 'announce' | 'details' | 'perfil' | 'editar-perfil' | 'my-announcements' | 'edit-item' | 'dashboard' | 'chat' | 'admin';

interface Toast {
  id: string;
  message: string;
  subtitle?: string;
  type: 'info' | 'success';
}
type AuthMode = 'login' | 'register' | 'forgot-password' | 'update-password';

// ─── Tela de verificação MFA (AAL2) ──────────────────────────────────────────

const MfaChallenge: React.FC<{
  factorId: string;
  challengeId: string;
  onSuccess: () => void;
}> = ({ factorId, challengeId, onSuccess }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code,
    });

    if (verifyError) {
      setError('Código inválido. Verifique e tente novamente.');
    } else {
      onSuccess();
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white rounded-3xl shadow-xl p-10 w-full max-w-sm">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Verificação em Duas Etapas</h2>
        <p className="text-gray-500 text-sm mb-6">
          Insira o código de 6 dígitos gerado pelo seu aplicativo autenticador.
        </p>
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm text-center font-medium">
            {error}
          </div>
        )}
        <form onSubmit={handleVerify} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="w-full bg-gray-100 rounded-xl px-4 py-3 text-center text-2xl tracking-widest text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            disabled={loading}
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full py-3 rounded-full bg-blue-700 text-white font-bold text-base tracking-widest hover:bg-blue-800 transition disabled:opacity-60"
          >
            {loading ? 'VERIFICANDO...' : 'VERIFICAR'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ─── Conteúdo principal ───────────────────────────────────────────────────────

const VALID_MODES: AppMode[] = ['home', 'announce', 'details', 'perfil', 'editar-perfil', 'my-announcements', 'edit-item', 'dashboard', 'chat', 'admin'];

const AppContent: React.FC = () => {
  const { session, loading, signOut, profile, isAdmin } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>('login');

  // ── Toast notifications ───────────────────────────────────────────────────
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: Toast['type'] = 'info', subtitle?: string) => {
    const id = Date.now().toString() + Math.random();
    setToasts(prev => [...prev, { id, message, subtitle, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000);
  }, []);

  useEffect(() => {
    if (!profile?.id || !session) return;

    // Subscription para mudanças em solicitacao_aluguel (sem filtro — verificação client-side)
    const solChannel = supabase.channel(`app-sol-notifs-${profile.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'solicitacao_aluguel' },
        (payload) => { console.log('[Notif] sol event:', payload); }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'solicitacao_aluguel' },
        async (payload) => {
          const sol = payload.new as any;
          if (sol.idlocador !== profile.id) return; // só interessa ao locador do item
          const [itemRes, userRes] = await Promise.all([
            supabase.from('item').select('nome').eq('iditem', sol.iditem).single(),
            supabase.from('users').select('fullName').eq('id', sol.idlocatario).single(),
          ]);
          const nome = userRes.data?.fullName || 'Alguém';
          const item = itemRes.data?.nome || 'item';
          showToast(`${nome} solicitou "${item}"`, 'info', 'Acesse o Chat para aceitar ou recusar o pedido.');
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'solicitacao_aluguel' },
        async (payload) => {
          const newSol = payload.new as any;
          const oldSol = payload.old as any;
          // old.status pode ser undefined se REPLICA IDENTITY não for FULL — usa fallback
          if (oldSol?.status && newSol.status === oldSol.status) return;

          const isLocador   = newSol.idlocador   === profile.id;
          const isLocatario = newSol.idlocatario === profile.id;
          if (!isLocador && !isLocatario) return;

          const itemRes = await supabase.from('item').select('nome').eq('iditem', newSol.iditem).single();
          const item = itemRes.data?.nome || 'Item';

          // Notificações para o LOCATÁRIO (locador mudou o status)
          if (isLocatario) {
            if (newSol.status === 'aprovado')
              showToast(`Seu aluguel de "${item}" foi aprovado!`, 'success', 'Aguarde o locador registrar o estado do item.');
            else if (newSol.status === 'aguardando_entrega')
              showToast(`"${item}" está pronto para entrega!`, 'success', 'Acesse o Chat e confirme o recebimento com uma foto.');
            else if (newSol.status === 'rejeitado')
              showToast(`Pedido de "${item}" recusado`, 'info', 'O locador não pôde aceitar desta vez.');
            else if (newSol.status === 'concluido')
              showToast(`Aluguel de "${item}" concluído!`, 'success', 'Obrigado por usar o AlugApp!');
          }

          // Notificações para o LOCADOR (locatário mudou o status)
          if (isLocador) {
            const userRes = await supabase.from('users').select('fullName').eq('id', newSol.idlocatario).single();
            const nome = userRes.data?.fullName || 'Locatário';
            if (newSol.status === 'em_andamento')
              showToast(`${nome} confirmou o recebimento de "${item}"`, 'success', 'O item está em uso. Aguarde a devolução.');
            else if (newSol.status === 'concluido')
              showToast(`${nome} devolveu "${item}"`, 'success', 'Aluguel concluído com sucesso!');
            else if (newSol.status === 'cancelado')
              showToast(`${nome} cancelou o pedido de "${item}"`, 'info', 'A solicitação foi encerrada.');
          }
        }
      )
      .subscribe((status, err) => {
        console.log('[Notif] solChannel status:', status, err ?? '');
      });

    // Subscription separada para mensagens (evita conflito de múltiplas tabelas no mesmo canal)
    const msgChannel = supabase.channel(`app-msg-notifs-${profile.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagem' },
        async (payload) => {
          console.log('[Notif] msg event:', payload);
          const msg = payload.new as any;
          if (msg.idremetente === profile.id) return;
          const solRes = await supabase
            .from('solicitacao_aluguel')
            .select('idlocador, idlocatario')
            .eq('idsolicitacao', msg.idsolicitacao)
            .single();
          const sol = solRes.data as any;
          if (!sol || (sol.idlocador !== profile.id && sol.idlocatario !== profile.id)) return;
          const userRes = await supabase.from('users').select('fullName').eq('id', msg.idremetente).single();
          const nome = userRes.data?.fullName || 'Alguém';
          const preview = msg.conteudo?.length > 60 ? msg.conteudo.slice(0, 60) + '…' : msg.conteudo;
          showToast(`Mensagem de ${nome}`, 'info', preview);
        }
      )
      .subscribe((status, err) => {
        console.log('[Notif] msgChannel status:', status, err ?? '');
      });

    return () => {
      supabase.removeChannel(solChannel);
      supabase.removeChannel(msgChannel);
    };
  }, [profile?.id, session, showToast]);
  const [mode, setMode] = useState<AppMode>(() => {
    const saved = sessionStorage.getItem('app_mode') as AppMode | null;
    return saved && VALID_MODES.includes(saved) ? saved : 'home';
  });
  const [prevMode, setPrevMode] = useState<AppMode>('home');
  const [selectedItemId, setSelectedItemId] = useState<number | null>(() => {
    const saved = sessionStorage.getItem('app_item_id');
    return saved ? Number(saved) : null;
  });

  const navigate = (newMode: AppMode) => {
    sessionStorage.setItem('app_mode', newMode);
    setMode(newMode);
  };

  const goToDetails = (id: number) => {
    setPrevMode(mode);
    sessionStorage.setItem('app_item_id', String(id));
    setSelectedItemId(id);
    navigate('details');
  };

  // Estado de MFA pendente
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);

  // Escuta eventos de Auth para detectar recuperação de senha
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('update-password');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Verifica se MFA (AAL2) é necessário — roda apenas quando o user muda (login/logout)
  useEffect(() => {
    if (!session?.user?.id) {
      setMfaRequired(false);
      return;
    }

    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (data && data.nextLevel === 'aal2' && data.nextLevel !== data.currentLevel) {
        supabase.auth.mfa.listFactors().then(({ data: factors }) => {
          const totp = factors?.totp?.[0];
          if (totp) {
            supabase.auth.mfa.challenge({ factorId: totp.id }).then(({ data: ch }) => {
              if (ch) {
                setMfaFactorId(totp.id);
                setMfaChallengeId(ch.id);
                setMfaRequired(true);
              }
            });
          }
        });
      } else {
        setMfaRequired(false);
      }
    });
  }, [session?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="w-10 h-10 border-4 border-blue-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Perfil incompleto (OAuth sem cadastro) ──
  if (session && !loading && (!profile || !profile.cpf)) {
    return <CompletarPerfil />;
  }

  // ── Não autenticado ──
  if (!session || authMode === 'update-password') {
    if (authMode === 'register') {
      return <Cadastro onGoToLogin={() => setAuthMode('login')} />;
    }
    if (authMode === 'forgot-password') {
      return <RecuperarSenha onGoBack={() => setAuthMode('login')} />;
    }
    if (authMode === 'update-password') {
      return <RedefinirSenha
        onSuccess={async () => {
          await signOut();
          setAuthMode('login');
        }}
        onGoBack={async () => {
          await signOut();
          setAuthMode('login');
        }}
      />;
    }
    return (
      <Login
        onGoToRegister={() => setAuthMode('register')}
        onForgotPassword={() => setAuthMode('forgot-password')}
        onLoginSuccess={() => {}}
      />
    );
  }

  // ── MFA pendente ──
  if (mfaRequired && mfaFactorId && mfaChallengeId) {
    return (
      <MfaChallenge
        factorId={mfaFactorId}
        challengeId={mfaChallengeId}
        onSuccess={() => setMfaRequired(false)}
      />
    );
  }


  const renderContent = () => {
    if (mode === 'details' && selectedItemId !== null) {
      return <ItemDetalhes id={selectedItemId} onGoBack={() => navigate(prevMode)} />;
    }
    if (mode === 'announce') {
      return <AnunciarItem onGoBack={() => navigate('home')} />;
    }
    if (mode === 'perfil') {
      return (
        <Perfil
          onGoBack={() => navigate('home')}
          onLogout={() => navigate('home')}
          onGoToEditar={() => navigate('editar-perfil')}
          onGoToMyAnnouncements={() => navigate('my-announcements')}
          onGoToAdmin={() => navigate('admin')}
        />
      );
    }
    if (mode === 'editar-perfil') {
      return (
        <EditarPerfil
          onGoBack={() => navigate('perfil')}
          onGoHome={() => navigate('home')}
          onGoToMyAnnouncements={() => navigate('my-announcements')}
        />
      );
    }
    if (mode === 'my-announcements') {
      return (
        <MeusAnuncios
          onGoBack={() => navigate('home')}
          onGoToPerfil={() => navigate('perfil')}
          onGoToAnnounce={() => navigate('announce')}
          onOpenItem={(id) => goToDetails(id)}
          onEditItem={(id) => { sessionStorage.setItem('app_item_id', String(id)); setSelectedItemId(id); navigate('edit-item'); }}
        />
      );
    }
    if (mode === 'edit-item' && selectedItemId !== null) {
      return <EditarItem id={selectedItemId} onGoBack={() => navigate('my-announcements')} />;
    }
    if (mode === 'dashboard') {
      return (
        <Dashboard
          onGoHome={() => navigate('home')}
          onGoToPerfil={() => navigate('perfil')}
          onGoToMyAnnouncements={() => navigate('my-announcements')}
          onGoToChat={() => navigate('chat')}
        />
      );
    }
    if (mode === 'chat') {
      return (
        <Chat
          onGoBack={() => navigate('home')}
          onGoToPerfil={() => navigate('perfil')}
          onGoToMyAnnouncements={() => navigate('my-announcements')}
        />
      );
    }
    if (mode === 'admin') {
      if (!isAdmin) {
        navigate('home');
        return null;
      }
      return (
        <Admin
          onGoBack={() => navigate('home')}
          onGoToPerfil={() => navigate('perfil')}
          onGoToChatWithUser={(targetUserId, targetUserName) => {
            sessionStorage.setItem('open_chat_user_id', String(targetUserId));
            sessionStorage.setItem('open_chat_user_name', targetUserName);
            navigate('chat');
          }}
          onOpenItem={(id) => goToDetails(id)}
        />
      );
    }

    return (
      <Home
        onGoToAnnounce={() => navigate('announce')}
        onGoToPerfil={() => navigate('perfil')}
        onGoToMyAnnouncements={() => navigate('my-announcements')}
        onOpenItem={(id) => goToDetails(id)}
        onGoToDashboard={() => navigate('dashboard')}
        onGoToChat={() => navigate('chat')}
      />
    );
  };

  return (
    <>
      {renderContent()}
      <BottomNav mode={mode} navigate={navigate} />

      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`bg-white border shadow-lg rounded-2xl px-4 py-3 max-w-sm flex items-start gap-3 pointer-events-auto ${
              t.type === 'success' ? 'border-green-200' : 'border-blue-200'
            }`}
          >
            <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${t.type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 leading-snug">{t.message}</p>
              {t.subtitle && (
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">{t.subtitle}</p>
              )}
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="text-gray-300 hover:text-gray-500 flex-shrink-0 text-base leading-none"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </>
  );
};

// ─── App raiz com Provider ────────────────────────────────────────────────────

const App: React.FC = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default App;