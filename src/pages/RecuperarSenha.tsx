import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ArrowLeft, Mail } from 'lucide-react';

interface RecuperarSenhaProps {
  onGoBack: () => void;
}

const RecuperarSenha: React.FC<RecuperarSenhaProps> = ({ onGoBack }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({
        type: 'success',
        text: 'E-mail de recuperação enviado! Verifique sua caixa de entrada.',
      });
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white rounded-3xl shadow-xl p-10 w-full max-w-md">
        <button
          onClick={onGoBack}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6 transition"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Voltar para o Login</span>
        </button>

        <h2 className="text-3xl font-bold text-gray-900 mb-2 text-center">Recuperar Senha</h2>
        <p className="text-gray-500 text-sm mb-8 text-center">
          Insira o seu e-mail para receber as instruções de recuperação de senha.
        </p>

        {message && (
          <div className={`mb-6 p-4 rounded-xl text-center text-sm font-medium ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="w-full bg-gray-100 rounded-xl pl-10 pr-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-full bg-blue-700 text-white font-bold text-base tracking-widest hover:bg-blue-800 transition disabled:opacity-60"
          >
            {loading ? 'ENVIANDO...' : 'ENVIAR E-MAIL'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default RecuperarSenha;
