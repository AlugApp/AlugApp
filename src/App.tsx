import React, { useEffect, useState } from 'react';
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
import BottomNav from './components/BottomNav';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type AppMode = 'home' | 'announce' | 'details' | 'perfil' | 'editar-perfil' | 'my-announcements' | 'edit-item' | 'dashboard' | 'chat';
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

const VALID_MODES: AppMode[] = ['home', 'announce', 'details', 'perfil', 'editar-perfil', 'my-announcements', 'edit-item', 'dashboard', 'chat'];

const AppContent: React.FC = () => {
  const { session, loading, signOut, profile } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>('login');
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