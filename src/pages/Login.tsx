import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { IconBaseProps } from 'react-icons';
import { FaGoogle } from 'react-icons/fa';
import { User, Lock, Eye, EyeOff } from 'lucide-react';

type MessageState = { type: 'success' | 'error'; text: string } | null;

interface LoginFormProps {
  onGoToRegister: () => void;
  onForgotPassword: () => void;
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginFormProps> = ({ onGoToRegister, onForgotPassword }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);

  const handleOAuth = async (provider: 'google') => {
    setMessage(null);
    const redirectUrl = process.env.REACT_APP_SITE_URL || window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) setMessage({ type: 'error', text: 'Erro ao autenticar. Tente novamente.' });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // O autofill do navegador às vezes preenche os campos sem disparar onChange,
    // deixando o state do React vazio mesmo com os inputs visivelmente preenchidos.
    // Lemos o valor real do DOM no momento do envio para evitar login "silencioso".
    const formData = new FormData(e.currentTarget);
    const finalEmail = (formData.get('email') as string) || email;
    const finalPassword = (formData.get('password') as string) || password;

    if (!finalEmail.trim() || !finalPassword) {
      setMessage({ type: 'error', text: 'Preencha e-mail e senha.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email: finalEmail, password: finalPassword });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('email not confirmed')) {
          setMessage({ type: 'error', text: 'E-mail não confirmado. Verifique sua caixa de entrada e clique no link de confirmação.' });
        } else if (msg.includes('invalid login credentials') || msg.includes('invalid email or password')) {
          setMessage({ type: 'error', text: 'E-mail ou senha inválidos.' });
        } else {
          setMessage({ type: 'error', text: error.message });
        }
        return;
      }

      setMessage({ type: 'success', text: 'Login realizado! Redirecionando...' });
    } catch {
      setMessage({ type: 'error', text: 'Erro inesperado. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  };

  const googleButton = (
    <button
      onClick={() => handleOAuth('google')}
      className="w-full flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3 bg-white hover:bg-gray-50 active:bg-gray-100 transition shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
          </svg>
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold text-gray-800 leading-tight">Continuar com o Google</p>
          <p className="text-xs text-gray-400">Acesse com sua conta Google</p>
        </div>
      </div>
      {React.createElement(FaGoogle as React.FunctionComponent<IconBaseProps>, { size: 20, color: '#EA4335' })}
    </button>
  );

  return (
    <>
      {/* ── MOBILE ───────────────────────────────────────────────────────── */}
      <div className="md:hidden min-h-screen bg-white flex flex-col">
        <div className="bg-blue-700 px-6 pt-12 pb-16 flex flex-col items-center text-center">
          <img src="/AlugApp-Branco.png" alt="AlugApp" className="w-14 h-14 mb-4" />
          <h1 className="text-2xl font-extrabold text-white leading-tight">Bem-vindo de volta!</h1>
          <p className="text-blue-200 text-sm mt-2">Acesse sua conta agora mesmo.</p>
        </div>

        <div className="flex-1 -mt-8 bg-white rounded-t-[2rem] px-6 pt-8 pb-10 relative z-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-5">Entrar</h2>

          {googleButton}

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">ou continue com e-mail</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {message && (
            <div className={`mb-4 p-3 rounded-xl text-center text-sm font-medium ${
              message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
            }`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                name="email" type="email" placeholder="E-mail" value={email}
                onChange={(e) => { setEmail(e.target.value); setMessage(null); }}
                required disabled={loading}
                className="w-full bg-gray-100 rounded-xl pl-10 pr-4 py-3.5 text-base text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                name="password" type={showPassword ? 'text' : 'password'} placeholder="Senha" value={password}
                onChange={(e) => { setPassword(e.target.value); setMessage(null); }}
                required disabled={loading}
                className="w-full bg-gray-100 rounded-xl pl-10 pr-10 py-3.5 text-base text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1" tabIndex={-1}>
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <div className="flex justify-end text-sm">
              <button type="button" className="text-blue-600 hover:underline py-1" onClick={onForgotPassword}>
                Esqueceu a senha?
              </button>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-full bg-blue-700 text-white font-bold text-base tracking-widest hover:bg-blue-800 active:bg-blue-900 transition disabled:opacity-60">
              {loading ? 'ENTRANDO...' : 'ENTRAR'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-8">
            Não tem uma conta?{' '}
            <button onClick={onGoToRegister} className="text-blue-700 font-semibold hover:underline">
              Criar conta
            </button>
          </p>
        </div>
      </div>

      {/* ── DESKTOP ──────────────────────────────────────────────────────── */}
      <div className="hidden md:flex items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="flex w-full max-w-4xl bg-white rounded-3xl shadow-xl overflow-hidden">

          {/* LADO ESQUERDO */}
          <div className="flex-1 p-10 flex flex-col relative">
            <img src="/AlugApp-Azul.png" alt="AlugApp" className="w-20 h-20 absolute top-3 left-3" />

            <div className="flex flex-col items-center flex-1 justify-center mt-8">
              <h2 className="text-4xl font-bold text-gray-900 mb-7">Entrar</h2>

              {/* Botão Google */}
              <div className="w-full max-w-sm mb-5">{googleButton}</div>

              <div className="flex items-center gap-3 w-full max-w-sm mb-5">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">ou continue com e-mail</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {message && (
                <div className={`w-full max-w-sm mb-4 p-3 rounded-xl text-center text-sm font-medium ${
                  message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                }`}>
                  {message.text}
                </div>
              )}

              <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    name="email" type="email" placeholder="E-mail" value={email}
                    onChange={(e) => { setEmail(e.target.value); setMessage(null); }}
                    required disabled={loading}
                    className="w-full bg-gray-100 rounded-xl pl-10 pr-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    name="password" type={showPassword ? 'text' : 'password'} placeholder="Senha" value={password}
                    onChange={(e) => { setPassword(e.target.value); setMessage(null); }}
                    required disabled={loading}
                    className="w-full bg-gray-100 rounded-xl pl-10 pr-10 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                <div className="flex justify-end text-sm">
                  <button type="button" className="text-blue-600 hover:underline" onClick={onForgotPassword}>
                    Esqueceu a senha?
                  </button>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-full bg-blue-700 text-white font-bold text-base tracking-widest hover:bg-blue-800 transition disabled:opacity-60 mt-2">
                  {loading ? 'ENTRANDO...' : 'ENTRAR'}
                </button>
              </form>
            </div>
          </div>

          {/* LADO DIREITO */}
          <div className="w-96 bg-blue-700 flex flex-col items-center justify-center p-10 gap-6">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-white leading-tight mb-3">
                Seja<br />bem-vindo!
              </h2>
              <p className="text-blue-200 text-sm leading-relaxed">
                Não tem uma conta?<br />Crie a sua agora mesmo.
              </p>
            </div>
            <button onClick={onGoToRegister}
              className="border-2 border-white text-white font-bold py-3 px-10 rounded-full text-sm tracking-widest hover:bg-white hover:text-blue-700 transition">
              CRIAR CONTA
            </button>
          </div>

        </div>
      </div>
    </>
  );
};

export default Login;
