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
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) setMessage({ type: 'error', text: 'Erro ao autenticar. Tente novamente.' });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

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

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="flex w-full max-w-4xl bg-white rounded-3xl shadow-xl overflow-hidden">

        {/* LADO ESQUERDO */}
        <div className="flex-1 p-10 flex flex-col relative">
          <img src="/AlugApp-Azul.png" alt="AlugApp" className="w-20 h-20 absolute top-3 left-3" />

          <div className="flex flex-col items-center flex-1 justify-center mt-8">
            <h2 className="text-4xl font-bold text-gray-900 mb-7">Entrar</h2>

            {/* Botão Google */}
            <button
              onClick={() => handleOAuth('google')}
              className="w-full max-w-sm flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3 bg-white hover:bg-gray-50 transition shadow-sm mb-5"
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
                  type="email" placeholder="E-mail" value={email}
                  onChange={(e) => { setEmail(e.target.value); setMessage(null); }}
                  required disabled={loading}
                  className="w-full bg-gray-100 rounded-xl pl-10 pr-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type={showPassword ? 'text' : 'password'} placeholder="Senha" value={password}
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
              Bem-Vindo,<br />Morador/a!
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
  );
};

export default Login;
