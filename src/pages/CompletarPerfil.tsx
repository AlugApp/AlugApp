import React, { useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, LogOut } from 'lucide-react';

const maskCPF = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const maskDate = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

const maskCEP = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
};

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const inputClass = 'w-full bg-gray-100 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm';

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
  return calcVerifier(9) === Number(digits[9]) && calcVerifier(10) === Number(digits[10]);
};

export default function CompletarPerfil() {
  const { user, refreshProfile } = useAuth();

  const googleName = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
  const googleEmail = user?.email || '';
  const googleAvatar = user?.user_metadata?.avatar_url || '';

  const [formData, setFormData] = useState({
    fullName: googleName,
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
  });

  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCep = useCallback(async (digits: string) => {
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
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
    } catch {}
    finally { setCepLoading(false); }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let v = value;
    if (name === 'cpf') v = maskCPF(value);
    else if (name === 'birthDate') v = maskDate(value);
    else if (name === 'phone') v = maskPhone(value);
    else if (name === 'cep') {
      v = maskCEP(value);
      const digits = value.replace(/\D/g, '');
      if (digits.length === 8) fetchCep(digits);
    } else if (name === 'numero') v = v.replace(/\D/g, '').slice(0, 6);
    setFormData((prev) => ({ ...prev, [name]: v }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // CPF
    const cpfDigits = formData.cpf.replace(/\D/g, '');
    if (cpfDigits.length !== 11) { setError('CPF deve ter 11 dígitos.'); return; }
    if (!validateCPF(formData.cpf)) { setError('CPF inválido. Verifique os dígitos e tente novamente.'); return; }

    // Telefone
    const phoneDigits = formData.phone.replace(/\D/g, '');
    const ddd = parseInt(phoneDigits.substring(0, 2));
    if (phoneDigits.length !== 11) { setError('Número de celular inválido. Use o formato (XX) 9XXXX-XXXX.'); return; }
    if (ddd < 11 || ddd > 99) { setError('DDD inválido. Verifique o número de telefone.'); return; }
    if (phoneDigits[2] !== '9') { setError('Número de celular inválido. O dígito após o DDD deve ser 9.'); return; }

    // CEP
    const cepDigits = formData.cep.replace(/\D/g, '');
    if (cepDigits.length !== 8) { setError('CEP deve ter 8 dígitos.'); return; }

    // Data de nascimento
    const dateParts = formData.birthDate.split('/');
    const [dStr, mStr, yStr] = dateParts;
    const parsedDate = dateParts.length === 3 ? new Date(`${yStr}-${mStr}-${dStr}`) : null;
    if (!parsedDate || isNaN(parsedDate.getTime()) || yStr?.length !== 4
        || parseInt(mStr) < 1 || parseInt(mStr) > 12
        || parseInt(dStr) < 1 || parseInt(dStr) > 31) {
      setError('Data de nascimento inválida. Use o formato dd/mm/aaaa.');
      return;
    }
    const isoDate = `${yStr}-${mStr}-${dStr}`;

    setLoading(true);

    // CPF duplicado
    const { data: cpfExists } = await supabase.from('users').select('id').eq('cpf', formData.cpf).maybeSingle();
    if (cpfExists) { setError('CPF já cadastrado. Utilize outro CPF ou faça login.'); setLoading(false); return; }

    // Telefone duplicado
    const { data: phoneExists } = await supabase.from('users').select('id').eq('phone', formData.phone).maybeSingle();
    if (phoneExists) { setError('Número de celular já cadastrado. Utilize outro número ou faça login.'); setLoading(false); return; }

    const { error: dbError } = await supabase.from('users').upsert([{
      auth_id: user!.id,
      fullName: formData.fullName,
      email: googleEmail,
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
    }], { onConflict: 'auth_id' });

    if (dbError) {
      const msg = dbError.message.toLowerCase();
      let text = 'Erro ao salvar perfil. Tente novamente.';
      if (msg.includes('duplicate key') && msg.includes('cpf')) text = 'CPF já cadastrado. Utilize outro CPF ou faça login.';
      else if (msg.includes('duplicate key') && msg.includes('phone')) text = 'Número de celular já cadastrado. Utilize outro número ou faça login.';
      else if (msg.includes('duplicate key')) text = 'Dados duplicados. Verifique CPF e telefone informados.';
      else if (msg.includes('date/time') || msg.includes('out of range')) text = 'Data de nascimento inválida. Verifique o formato dd/mm/aaaa.';
      else if (msg.includes('null value') || msg.includes('not null')) text = 'Preencha todos os campos obrigatórios.';
      setError(text);
      setLoading(false);
      return;
    }

    await refreshProfile();
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="flex w-full max-w-5xl bg-white rounded-3xl shadow-xl overflow-hidden">

        {/* PAINEL ESQUERDO */}
        <div className="w-64 flex-shrink-0 bg-blue-700 flex flex-col p-8 relative">
          <img src="/AlugApp-Branco.png" alt="AlugApp" className="w-20 h-20 absolute top-3 left-3" />

          <div className="flex flex-col justify-center flex-1 mt-16 gap-5">
            <div className="flex flex-col items-center gap-3">
              {googleAvatar ? (
                <img
                  src={googleAvatar}
                  alt={googleName}
                  className="w-16 h-16 rounded-full border-4 border-white shadow-md"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-blue-500 border-4 border-white flex items-center justify-center text-white text-2xl font-bold">
                  {googleName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-center">
                <p className="text-white font-semibold text-sm leading-tight">{googleName}</p>
                <p className="text-blue-200 text-xs mt-0.5 break-all">{googleEmail}</p>
              </div>
            </div>

            <div className="border-t border-blue-500 pt-5">
              <h2 className="text-2xl font-extrabold text-white leading-tight mb-3">
                Quase lá!
              </h2>
              <p className="text-blue-200 text-sm leading-relaxed">
                Complete seu perfil para começar a usar o AlugApp.
              </p>
            </div>

            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="flex items-center gap-2 text-blue-200 hover:text-white text-xs transition mt-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair da conta
            </button>
          </div>
        </div>

        {/* FORMULÁRIO */}
        <div className="flex-1 p-8 overflow-y-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-5">Complete seu perfil</h2>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium text-center">{error}</div>
          )}

          <p className="text-center text-gray-400 text-sm mb-5">Conectado via Google</p>

          <form onSubmit={handleSubmit} className="space-y-3">

            {/* Nome */}
            <input
              type="text" name="fullName" value={formData.fullName} onChange={handleChange}
              placeholder="Nome Completo*" className={inputClass} required disabled={loading}
            />

            {/* CPF | Telefone */}
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text" name="cpf" value={formData.cpf} onChange={handleChange}
                placeholder="CPF*" className={inputClass} required disabled={loading}
              />
              <input
                type="tel" name="phone" value={formData.phone} onChange={handleChange}
                placeholder="Telefone*" className={inputClass} required disabled={loading}
              />
            </div>

            {/* Data de nascimento | Gênero */}
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text" name="birthDate" value={formData.birthDate} onChange={handleChange}
                placeholder="dd/mm/aaaa*" className={inputClass} required disabled={loading}
              />
              <div className="relative">
                <select
                  name="gender" value={formData.gender} onChange={handleChange}
                  className={`${inputClass} appearance-none pr-10`} required disabled={loading}
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

            {/* ENDEREÇO */}
            <div className="border-t border-gray-200 pt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Endereço</p>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="relative">
                  <input
                    type="text" name="cep" value={formData.cep} onChange={handleChange}
                    placeholder="CEP*" className={inputClass} required disabled={loading}
                  />
                  {cepLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />}
                </div>
                <input
                  type="text" name="rua" value={formData.rua} onChange={handleChange}
                  placeholder="Rua / Logradouro*" className={`${inputClass} col-span-2`} required disabled={loading}
                />
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <input
                  type="text" name="numero" value={formData.numero} onChange={handleChange}
                  placeholder="Número*" className={inputClass} required disabled={loading}
                />
                <input
                  type="text" name="complemento" value={formData.complemento} onChange={handleChange}
                  placeholder="Complemento" className={inputClass} disabled={loading}
                />
                <input
                  type="text" name="bairro" value={formData.bairro} onChange={handleChange}
                  placeholder="Bairro*" className={inputClass} required disabled={loading}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text" name="cidade" value={formData.cidade} onChange={handleChange}
                  placeholder="Cidade*" className={inputClass} required disabled={loading}
                />
                <div className="relative">
                  <select
                    name="estado" value={formData.estado} onChange={handleChange}
                    className={`${inputClass} appearance-none pr-10`} required disabled={loading}
                  >
                    <option value="">Estado*</option>
                    {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                  <div className="absolute right-0 top-0 h-full w-10 bg-blue-700 rounded-r-xl flex items-center justify-center pointer-events-none">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full py-3 rounded-full bg-blue-700 text-white font-bold text-base tracking-widest hover:bg-blue-800 transition disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> SALVANDO...</> : 'CONCLUIR CADASTRO'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
