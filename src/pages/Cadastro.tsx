import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { IconBaseProps } from 'react-icons';
import { FaFacebookF, FaGoogle, FaApple } from 'react-icons/fa';
import { Eye, EyeOff } from 'lucide-react';

type MessageState = { type: 'success' | 'error'; text: string } | null;

interface RegistrationFormProps {
  onGoToLogin: () => void;
}

const inputClass =
  'w-full bg-gray-100 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm';

const Cadastro: React.FC<RegistrationFormProps> = ({ onGoToLogin }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    rg: '',
    cpf: '',
    birthDate: '',
    phone: '',
    gender: '',
    address: '',
    apartment: '',
    block: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    let v = value;

    if (name === 'cpf') {
      v = v.replace(/\D/g, '').slice(0, 11);
      if (v.length === 11) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (name === 'phone') {
      v = v.replace(/\D/g, '').slice(0, 11);
      if (v.length === 11) v = v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (name === 'apartment') {
      v = v.replace(/\D/g, '').slice(0, 4);
    } else if (name === 'block') {
      v = v.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 1);
    }

    setFormData({ ...formData, [name]: v });
    setMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    // ── Validações ──────────────────────────────────────────────────────────
    if (formData.password !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas não coincidem!' });
      setLoading(false);
      return;
    }
    if (formData.password.length < 6) {
      setMessage({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' });
      setLoading(false);
      return;
    }
    if (!/[A-Z]/.test(formData.password) || !/[0-9]/.test(formData.password)) {
      setMessage({ type: 'error', text: 'A senha deve conter pelo menos 1 letra maiúscula e 1 número.' });
      setLoading(false);
      return;
    }

    try {
      // ── 1. Cria conta no Supabase Auth (senha hasheada automaticamente) ──
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (authError) {
        setMessage({ type: 'error', text: authError.message });
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setMessage({ type: 'error', text: 'Erro ao criar a conta. Tente novamente.' });
        setLoading(false);
        return;
      }

      // ── 2. Insere perfil na tabela users (SEM senha) ──────────────────────
      const { error: profileError } = await supabase.from('users').insert([{
        auth_id: authData.user.id,
        fullName: formData.fullName,
        email: formData.email,
        cpf: formData.cpf,
        birthDate: formData.birthDate,
        phone: formData.phone,
        gender: formData.gender,
        address: formData.address,
        apartment: formData.apartment,
        block: formData.block,
      }]);

      if (profileError) {
        setMessage({
          type: 'error',
          text: 'Conta criada, mas erro ao salvar perfil: ' + profileError.message,
        });
        setLoading(false);
        return;
      }

      // ── 3. Sucesso ────────────────────────────────────────────────────────
      setMessage({
        type: 'success',
        text: `Conta criada! Enviamos um e-mail de confirmação para ${formData.email}. Verifique sua caixa de entrada antes de fazer login.`,
      });
      setFormData({
        fullName: '', email: '', rg: '', cpf: '', birthDate: '',
        phone: '', gender: '', address: '', apartment: '', block: '',
        password: '', confirmPassword: '',
      });
      setTimeout(() => onGoToLogin(), 5000);
    } catch {
      setMessage({ type: 'error', text: 'Erro inesperado. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="flex w-full max-w-5xl bg-white rounded-3xl shadow-xl overflow-hidden">

        {/* LADO ESQUERDO — Azul */}
        <div className="w-64 flex-shrink-0 bg-blue-700 flex flex-col p-8 relative">
          <img
            src="/AlugAppOgol.png"
            alt="AlugApp"
            className="w-14 h-14 absolute top-6 left-6"
          />

          <div className="flex flex-col justify-center flex-1 mt-16 gap-5">
            <div>
              <h2 className="text-2xl font-extrabold text-white leading-tight mb-3">
                Bem-Vindo<br />De Volta!
              </h2>
              <p className="text-blue-200 text-sm leading-relaxed">
                Acesse sua conta agora mesmo.
              </p>
            </div>

            <button
              type="button"
              onClick={onGoToLogin}
              className="border-2 border-white text-white font-bold py-3 px-6 rounded-full text-sm tracking-widest hover:bg-white hover:text-blue-700 transition w-full"
            >
              ENTRAR
            </button>
          </div>
        </div>

        {/* LADO DIREITO — Formulário */}
        <div className="flex-1 p-8 overflow-y-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-5">Criar Conta</h2>

          {/* Ícones sociais */}
          <div className="flex justify-center gap-4 mb-3">
            <button className="w-11 h-11 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition">
              {React.createElement(FaFacebookF as React.FunctionComponent<IconBaseProps>, { size: 16, color: '#1877F2' })}
            </button>
            <button className="w-11 h-11 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition">
              {React.createElement(FaGoogle as React.FunctionComponent<IconBaseProps>, { size: 16, color: '#EA4335' })}
            </button>
            <button className="w-11 h-11 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition">
              {React.createElement(FaApple as React.FunctionComponent<IconBaseProps>, { size: 18, color: '#000' })}
            </button>
          </div>
          <p className="text-center text-gray-400 text-sm mb-5">ou crie sua conta</p>

          {/* Feedback */}
          {message && (
            <div className={`mb-4 p-3 rounded-xl text-center text-sm font-medium ${
              message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
            }`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">

            {/* Nome Completo */}
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Nome Completo*"
              className={inputClass}
              required
              disabled={loading}
            />

            {/* E-mail | RG | CPF */}
            <div className="grid grid-cols-3 gap-3">
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="E-mail*"
                className={inputClass}
                required
                disabled={loading}
              />
              <input
                type="text"
                name="rg"
                value={formData.rg}
                onChange={handleChange}
                placeholder="RG*"
                className={inputClass}
                required
                disabled={loading}
              />
              <input
                type="text"
                name="cpf"
                value={formData.cpf}
                onChange={handleChange}
                placeholder="CPF*"
                className={inputClass}
                required
                disabled={loading}
              />
            </div>

            {/* Data | Telefone | Gênero */}
            <div className="grid grid-cols-3 gap-3">
              <input
                type="date"
                name="birthDate"
                value={formData.birthDate}
                onChange={handleChange}
                className={inputClass}
                required
                disabled={loading}
              />
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Telefone*"
                className={inputClass}
                required
                disabled={loading}
              />
              {/* Gênero */}
              <div className="relative">
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className={`${inputClass} appearance-none pr-10`}
                  required
                  disabled={loading}
                >
                  <option value="">Gênero*</option>
                  <option value="male">Masculino</option>
                  <option value="female">Feminino</option>
                  <option value="other">Outro</option>
                </select>
                <div className="absolute right-0 top-0 h-full w-10 bg-blue-700 rounded-r-xl flex items-center justify-center pointer-events-none">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Residencial | Apto | Bloco */}
            <div className="grid grid-cols-4 gap-3">
              <div className="relative col-span-2">
                <select
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className={`${inputClass} appearance-none pr-10`}
                  required
                  disabled={loading}
                >
                  <option value="">Residencial*</option>
                  <option value="Bloco A">Bloco A</option>
                  <option value="Bloco B">Bloco B</option>
                  <option value="Bloco C">Bloco C</option>
                  <option value="Bloco D">Bloco D</option>
                  <option value="Outro">Outro</option>
                </select>
                <div className="absolute right-0 top-0 h-full w-10 bg-blue-700 rounded-r-xl flex items-center justify-center pointer-events-none">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <input
                type="text"
                name="apartment"
                value={formData.apartment}
                onChange={handleChange}
                placeholder="Apto*"
                className={inputClass}
                required
                disabled={loading}
              />
              <input
                type="text"
                name="block"
                value={formData.block}
                onChange={handleChange}
                placeholder="Bloco*"
                className={inputClass}
                required
                disabled={loading}
              />
            </div>

            {/* Senha */}
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Senha*"
                className={`${inputClass} pr-10`}
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-800"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Confirmar Senha */}
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirmar Senha*"
                className={`${inputClass} pr-10`}
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-800"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Botão */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-full bg-blue-700 text-white font-bold text-base tracking-widest hover:bg-blue-800 transition disabled:opacity-60 mt-2"
            >
              {loading ? 'CADASTRANDO...' : 'CADASTRAR'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Cadastro;
