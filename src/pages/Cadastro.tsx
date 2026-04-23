import React, { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { IconBaseProps } from 'react-icons';
import { FaGoogle } from 'react-icons/fa';
import { Eye, EyeOff, Loader2, Calendar } from 'lucide-react';

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

const validateCPF = (cpf: string) => {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calcVerifier = (slice: number) => {
    const numbers = digits.slice(0, slice).split('').map(Number);
    const factor = slice + 1;
    const total = numbers.reduce((acc, num, index) => acc + num * (factor - index), 0);
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstVerifier = calcVerifier(9);
  const secondVerifier = calcVerifier(10);

  return firstVerifier === Number(digits[9]) && secondVerifier === Number(digits[10]);
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

const invalidClass =
  'w-full bg-red-50 border border-red-400 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm';

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
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());

  const handleOAuth = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) setMessage({ type: 'error', text: 'Erro ao autenticar com Google.' });
  };

  const ic = (field: string) => invalidFields.has(field) ? invalidClass : inputClass;
  const sc = (field: string) => `${ic(field)} appearance-none pr-10`;

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
    if (invalidFields.has(name)) {
      setInvalidFields(prev => { const s = new Set(prev); s.delete(name); return s; });
    }
  };

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    // ── Campos obrigatórios ─────────────────────────────────────────────────
    const required = ['fullName','email','cpf','birthDate','phone','gender','cep','rua','numero','bairro','cidade','estado','password','confirmPassword'] as const;
    const newInvalid = new Set<string>();
    for (const f of required) {
      if (!formData[f]) newInvalid.add(f);
    }
    if (newInvalid.size > 0) {
      setInvalidFields(newInvalid);
      setMessage({ type: 'error', text: 'Preencha todos os campos obrigatórios.' });
      setLoading(false);
      return;
    }

    // ── E-mail — formato ────────────────────────────────────────────────────
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.email)) {
      setInvalidFields(new Set(['email']));
      setMessage({ type: 'error', text: 'Insira um e-mail válido.' });
      setLoading(false);
      return;
    }

    // ── E-mail — verifica domínio (DNS) ─────────────────────────────────────
    try {
      const emailRes = await fetch(
        `https://disify.com/api/email/${encodeURIComponent(formData.email)}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (emailRes.ok) {
        const emailData = await emailRes.json();
        if (!emailData.format || !emailData.dns) {
          setInvalidFields(new Set(['email']));
          setMessage({ type: 'error', text: 'E-mail inválido ou domínio inexistente. Verifique e tente novamente.' });
          setLoading(false);
          return;
        }
        if (emailData.disposable) {
          setInvalidFields(new Set(['email']));
          setMessage({ type: 'error', text: 'E-mails temporários/descartáveis não são permitidos.' });
          setLoading(false);
          return;
        }
      }
    } catch {
      // API indisponível — continua apenas com validação de formato
    }

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
    if (!validateCPF(cpfDigits)) {
      setMessage({ type: 'error', text: 'CPF inválido. Verifique os dígitos e tente novamente.' });
      setLoading(false);
      return;
    }

    const cepDigits = formData.cep.replace(/\D/g, '');
    if (cepDigits.length !== 8) {
      setInvalidFields(new Set(['cep']));
      setMessage({ type: 'error', text: 'CEP deve ter 8 dígitos.' });
      setLoading(false);
      return;
    }

    // ── Telefone — formato brasileiro ────────────────────────────────────────
    const phoneDigits = formData.phone.replace(/\D/g, '');
    const ddd = parseInt(phoneDigits.substring(0, 2));
    if (phoneDigits.length !== 11) {
      setInvalidFields(new Set(['phone']));
      setMessage({ type: 'error', text: 'Número de celular inválido. Use o formato (XX) 9XXXX-XXXX com 11 dígitos.' });
      setLoading(false);
      return;
    }
    if (ddd < 11 || ddd > 99 || ddd === 20 || ddd === 23 || ddd === 25 || ddd === 26 || ddd === 29 || ddd === 30 || ddd === 36 || ddd === 39 || ddd === 40 || ddd === 50 || ddd === 52 || ddd === 56 || ddd === 57 || ddd === 58 || ddd === 59 || ddd === 60 || ddd === 70 || ddd === 72 || ddd === 76 || ddd === 78 || ddd === 80) {
      setInvalidFields(new Set(['phone']));
      setMessage({ type: 'error', text: 'DDD inválido. Verifique o número de telefone.' });
      setLoading(false);
      return;
    }
    if (phoneDigits[2] !== '9') {
      setInvalidFields(new Set(['phone']));
      setMessage({ type: 'error', text: 'Número de celular inválido. O dígito após o DDD deve ser 9.' });
      setLoading(false);
      return;
    }

    // ── Telefone duplicado ────────────────────────────────────────────────
    const { data: phoneExists } = await supabase
      .from('users').select('id').eq('phone', formData.phone).maybeSingle();
    if (phoneExists) {
      setInvalidFields(new Set(['phone']));
      setMessage({ type: 'error', text: 'Número de celular já cadastrado. Utilize outro número ou faça login.' });
      setLoading(false);
      return;
    }

    // ── Data de nascimento ────────────────────────────────────────────────
    const dateParts = formData.birthDate.split('/');
    const [dStr, mStr, yStr] = dateParts;
    const parsedDate = dateParts.length === 3
      ? new Date(`${yStr}-${mStr}-${dStr}`)
      : null;
    if (!parsedDate || isNaN(parsedDate.getTime()) || yStr?.length !== 4
        || parseInt(mStr) < 1 || parseInt(mStr) > 12
        || parseInt(dStr) < 1 || parseInt(dStr) > 31) {
      setInvalidFields(new Set(['birthDate']));
      setMessage({ type: 'error', text: 'Data de nascimento inválida. Use o formato dd/mm/aaaa.' });
      setLoading(false);
      return;
    }
    const isoDate = `${yStr}-${mStr}-${dStr}`;

    try {
      // ── 1. Cria conta no Supabase Auth ──────────────────────────────────
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: { emailRedirectTo: window.location.origin },
      });

      if (authError) {
        const msg = authError.message.toLowerCase();
        let text = 'Erro ao criar conta. Tente novamente.';
        if (msg.includes('already registered') || msg.includes('already exists')) {
          text = 'Já existe uma conta com este e-mail. Faça login.';
        } else if (msg.includes('rate limit') || msg.includes('too many')) {
          text = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
        } else if (msg.includes('invalid email')) {
          text = 'E-mail inválido. Verifique e tente novamente.';
        } else if (msg.includes('network') || msg.includes('fetch')) {
          text = 'Erro de conexão. Verifique sua internet.';
        } else if (msg.includes('weak password') || msg.includes('password')) {
          text = 'Senha fraca. Use pelo menos 6 caracteres com letras e números.';
        }
        setMessage({ type: 'error', text });
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
        birthDate: isoDate,
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
        const msg = profileError.message.toLowerCase();
        let text = 'Erro ao salvar perfil. Tente novamente.';
        if (msg.includes('duplicate key') && msg.includes('cpf')) {
          text = 'CPF já cadastrado. Utilize outro CPF ou faça login.';
        } else if (msg.includes('duplicate key') && msg.includes('email')) {
          text = 'E-mail já cadastrado. Utilize outro e-mail ou faça login.';
        } else if (msg.includes('duplicate key')) {
          text = 'Dados duplicados. Verifique CPF e e-mail informados.';
        } else if (msg.includes('date/time') || msg.includes('out of range') || msg.includes('invalid date')) {
          text = 'Data de nascimento inválida. Verifique o formato dd/mm/aaaa.';
          setInvalidFields(new Set(['birthDate']));
        } else if (msg.includes('null value') || msg.includes('not null')) {
          text = 'Preencha todos os campos obrigatórios.';
        } else if (msg.includes('network') || msg.includes('fetch')) {
          text = 'Erro de conexão. Verifique sua internet.';
        }
        setMessage({ type: 'error', text });
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
      setInvalidFields(new Set());
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
                Bem-vindo<br />de volta!
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

          {/* Google */}
          <button
            type="button"
            onClick={handleOAuth}
            className="w-full flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3 bg-white hover:bg-gray-50 transition shadow-sm mb-4"
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

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">ou crie sua conta</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Feedback */}
          {message && (
            <div className={`mb-4 p-3 rounded-xl text-center text-sm font-medium ${
              message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
            }`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-3">

            {/* Nome Completo */}
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Nome Completo*"
              className={ic('fullName')}
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
                className={ic('email')}
                disabled={loading}
              />
              <input
                type="text"
                name="cpf"
                value={formData.cpf}
                onChange={handleChange}
                placeholder="CPF*"
                className={ic('cpf')}
                disabled={loading}
              />
            </div>

            {/* Data | Telefone | Gênero */}
            <div className="grid grid-cols-3 gap-3">
              <div className="relative">
                <input
                  type="text"
                  name="birthDate"
                  value={formData.birthDate}
                  onChange={handleChange}
                  placeholder="Data de Nascimento*"
                  className={`${ic('birthDate')} pr-10`}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => dateInputRef.current?.showPicker()}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-800"
                  tabIndex={-1}
                  disabled={loading}
                >
                  <Calendar className="w-4 h-4" />
                </button>
                <input
                  ref={dateInputRef}
                  type="date"
                  className="sr-only"
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const [y, m, d] = e.target.value.split('-');
                    setFormData((prev) => ({ ...prev, birthDate: `${d}/${m}/${y}` }));
                  }}
                  disabled={loading}
                />
              </div>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Telefone*"
                className={ic('phone')}
                disabled={loading}
              />
              {/* Gênero */}
              <div className="relative">
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className={sc('gender')}
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
                    className={ic('cep')}
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
                  className={`${ic('rua')} col-span-2`}
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
                  className={ic('numero')}
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
                  className={ic('bairro')}
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
                  className={ic('cidade')}
                  disabled={loading}
                />
                <div className="relative">
                  <select
                    name="estado"
                    value={formData.estado}
                    onChange={handleChange}
                    className={sc('estado')}
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
                className={`${ic('password')} pr-10`}
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
                className={`${ic('confirmPassword')} pr-10`}
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
