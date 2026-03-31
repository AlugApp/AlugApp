import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { IconBaseProps } from 'react-icons';
import { FaFacebookF, FaGoogle, FaApple } from 'react-icons/fa';
import { User, Lock, Eye, EyeOff } from 'lucide-react';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_TOKEN!
);

type MessageState = { type: 'success' | 'error'; text: string } | null;

interface LoginFormProps {
  onGoToRegister: () => void;
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginFormProps> = ({ onGoToRegister, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .maybeSingle();

      if (error || !data) {
        setMessage({ type: 'error', text: 'E-mail ou senha inválidos.' });
      } else {
        setMessage({ type: 'success', text: `Bem-vindo(a), ${data.fullName || ''}` });
        localStorage.setItem('loggedUser', JSON.stringify(data));
        setTimeout(() => onLoginSuccess(), 800);
      }
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

          {/* Logo */}
          <img
            src="/AlugAppOgol.png"
            alt="AlugApp"
            className="w-14 h-14 absolute top-6 left-8"
          />

          <div className="flex flex-col items-center flex-1 justify-center mt-8">
            <h2 className="text-4xl font-bold text-gray-900 mb-7">Entrar</h2>

            {/* Ícones sociais */}
            <div className="flex gap-4 mb-5">
              <button className="w-12 h-12 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition">
                {React.createElement(FaFacebookF as React.FunctionComponent<IconBaseProps>, { size: 18, color: '#1877F2' })}
              </button>
              <button className="w-12 h-12 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition">
                {React.createElement(FaGoogle as React.FunctionComponent<IconBaseProps>, { size: 18, color: '#EA4335' })}
              </button>
              <button className="w-12 h-12 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition">
                {React.createElement(FaApple as React.FunctionComponent<IconBaseProps>, { size: 20, color: '#000' })}
              </button>
            </div>

            <p className="text-gray-400 text-sm mb-6">ou use sua conta de e-mail</p>

            {/* Feedback */}
            {message && (
              <div className={`w-full max-w-sm mb-4 p-3 rounded-xl text-center text-sm font-medium ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-600'
              }`}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">

              {/* E-mail */}
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  placeholder="E-mail"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setMessage(null); }}
                  required
                  disabled={loading}
                  className="w-full bg-gray-100 rounded-xl pl-10 pr-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Senha */}
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setMessage(null); }}
                  required
                  disabled={loading}
                  className="w-full bg-gray-100 rounded-xl pl-10 pr-10 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Lembrar + Esqueceu */}
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 rounded"
                  />
                  Lembrar minha conta
                </label>
                <button
                  type="button"
                  className="text-blue-600 hover:underline"
                  onClick={() => alert('Recuperação de senha não implementada.')}
                >
                  Esqueceu a senha?
                </button>
              </div>

              {/* Botão entrar */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-full bg-blue-700 text-white font-bold text-base tracking-widest hover:bg-blue-800 transition disabled:opacity-60 mt-2"
              >
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

          <button
            onClick={onGoToRegister}
            className="border-2 border-white text-white font-bold py-3 px-10 rounded-full text-sm tracking-widest hover:bg-white hover:text-blue-700 transition"
          >
            CRIAR CONTA
          </button>
        </div>

      </div>
    </div>
  );
};

export default Login;
