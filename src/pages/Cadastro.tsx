import React, { useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { IconBaseProps } from 'react-icons';
import { FaFacebookF, FaGoogle, FaApple } from 'react-icons/fa';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

type MessageState = { type: 'success' | 'error'; text: string } | null;

interface RegistrationFormProps {
  onGoToLogin: () => void;
}

// ─── Máscaras ─────────────────────────────────────────────────────────────────

const maskDate = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

const maskCPF = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const maskCEP = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
};

// ─── Lista de UFs ─────────────────────────────────────────────────────────────

const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

// ─── Componente ───────────────────────────────────────────────────────────────

const inputClass =
  'w-full bg-gray-100 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm';

const Cadastro: React.FC<RegistrationFormProps> = ({ onGoToLogin }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    cpf: '',
    birthDate: '',
    phone: '',
    gender: '',
    cep: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);

  // ─── ViaCEP ───────────────────────────────────────────────────────────────
  const fetchCep = useCallback(async (cepDigits: string) => {
    if (cepDigits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setFormData((prev) => ({
          ...prev,
          rua: data.logradouro || prev.rua,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
          estado: data.uf || prev.estado,
        }));
      }
    } catch {
      // silently ignore — user can fill manually
    } finally {
      setCepLoading(false);
    }
  }, []);

  // ─── handleChange com máscaras ────────────────────────────────────────────
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    let v = value;

    if (name === 'cpf') {
      v = maskCPF(value);
    } else if (name === 'birthDate') {
      v = maskDate(value);
    } else if (name === 'phone') {
      v = maskPhone(value);
    } else if (name === 'cep') {
      v = maskCEP(value);
      const digits = value.replace(/\D/g, '');
      if (digits.length === 8) fetchCep(digits);
    } else if (name === 'numero') {
      v = v.replace(/\D/g, '').slice(0, 6);
    }

    setFormData({ ...formData, [name]: v });
    setMessage(null);
  };

  // ─── Submit ───────────────────────────────────────────────────────────────
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

    const cpfDigits = formData.cpf.replace(/\D/g, '');
    if (cpfDigits.length !== 11) {
      setMessage({ type: 'error', text: 'CPF deve ter 11 dígitos.' });
      setLoading(false);
      return;
    }

    const cepDigits = formData.cep.replace(/\D/g, '');
    if (cepDigits.length !== 8) {
      setMessage({ type: 'error', text: 'CEP deve ter 8 dígitos.' });
      setLoading(false);
      return;
    }

    try {
      // ── 1. Cria conta no Supabase Auth ──────────────────────────────────
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

      // ── 2. Insere perfil na tabela users ────────────────────────────────
      const { error: profileError } = await supabase.from('users').insert([{
        auth_id: authData.user.id,
        fullName: formData.fullName,
        email: formData.email,
        cpf: formData.cpf,
        birthDate: formData.birthDate,
        phone: formData.phone,
        gender: formData.gender,
        cep: formData.cep,
        rua: formData.rua,
        numero: formData.numero,
        complemento: formData.complemento || null,
        bairro: formData.bairro,
        cidade: formData.cidade,
        estado: formData.estado,
      }]);

      if (profileError) {
        setMessage({
          type: 'error',
          text: 'Conta criada, mas erro ao salvar perfil: ' + profileError.message,
        });
        setLoading(false);
        return;
      }

      // ── 3. Sucesso ──────────────────────────────────────────────────────
      setMessage({
        type: 'success',
        text: `Conta criada! Enviamos um e-mail de confirmação para ${formData.email}. Verifique sua caixa de entrada antes de fazer login.`,
      });
      setFormData({
        fullName: '', email: '', cpf: '', birthDate: '',
        phone: '', gender: '', cep: '', rua: '', numero: '',
        complemento: '', bairro: '', cidade: '', estado: '',
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
            src="/AlugApp-Branco.png"
            alt="AlugApp"
            className="w-20 h-20 absolute top-3 left-3"
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

            {/* E-mail | CPF */}
            <div className="grid grid-cols-2 gap-3">
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
                type="text"
                name="birthDate"
                value={formData.birthDate}
                onChange={handleChange}
                placeholder="dd/mm/aaaa*"
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

            {/* ── ENDEREÇO ──────────────────────────────────────────────── */}
            <div className="border-t border-gray-200 pt-3 mt-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Endereço</p>

              {/* CEP | Rua */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="relative">
                  <input
                    type="text"
                    name="cep"
                    value={formData.cep}
                    onChange={handleChange}
                    placeholder="CEP*"
                    className={inputClass}
                    required
                    disabled={loading}
                  />
                  {cepLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />
                  )}
                </div>
                <input
                  type="text"
                  name="rua"
                  value={formData.rua}
                  onChange={handleChange}
                  placeholder="Rua / Logradouro*"
                  className={`${inputClass} col-span-2`}
                  required
                  disabled={loading}
                />
              </div>

              {/* Número | Complemento | Bairro */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                <input
                  type="text"
                  name="numero"
                  value={formData.numero}
                  onChange={handleChange}
                  placeholder="Número*"
                  className={inputClass}
                  required
                  disabled={loading}
                />
                <input
                  type="text"
                  name="complemento"
                  value={formData.complemento}
                  onChange={handleChange}
                  placeholder="Complemento"
                  className={inputClass}
                  disabled={loading}
                />
                <input
                  type="text"
                  name="bairro"
                  value={formData.bairro}
                  onChange={handleChange}
                  placeholder="Bairro*"
                  className={inputClass}
                  required
                  disabled={loading}
                />
              </div>

              {/* Cidade | Estado */}
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  name="cidade"
                  value={formData.cidade}
                  onChange={handleChange}
                  placeholder="Cidade*"
                  className={inputClass}
                  required
                  disabled={loading}
                />
                <div className="relative">
                  <select
                    name="estado"
                    value={formData.estado}
                    onChange={handleChange}
                    className={`${inputClass} appearance-none pr-10`}
                    required
                    disabled={loading}
                  >
                    <option value="">Estado*</option>
                    {UFS.map((uf) => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                  <div className="absolute right-0 top-0 h-full w-10 bg-blue-700 rounded-r-xl flex items-center justify-center pointer-events-none">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
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
