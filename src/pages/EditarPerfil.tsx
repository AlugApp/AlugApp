import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import {
  ArrowLeft,
  Home as HomeIcon,
  PlusCircle,
  MessageSquare,
  User,
  Loader2,

} from "lucide-react";

interface EditarPerfilProps {
  onGoBack: () => void;
  onGoHome: () => void;
  onGoToMyAnnouncements: () => void;
}

// ─── Máscaras ─────────────────────────────────────────────────────────────────

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

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function EditarPerfil({ onGoBack, onGoHome, onGoToMyAnnouncements }: EditarPerfilProps) {
  const { user, profile, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

const [form, setForm] = useState({
    fullName: "",
    cpf: "",
    email: "",
    birthDate: "",
    phone: "",
    gender: "",
    bio: "",
    cep: "",
    rua: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
  });

  // Carrega dados do perfil via AuthContext
  useEffect(() => {
    if (profile) {
      setForm({
        fullName: profile.fullName || "",
        cpf: profile.cpf || "",
        email: profile.email || "",
        birthDate: profile.birthDate || "",
        phone: profile.phone || "",
        gender: profile.gender || "",
        bio: (profile as any).bio || "",
        cep: profile.cep || "",
        rua: profile.rua || "",
        numero: profile.numero || "",
        complemento: profile.complemento || "",
        bairro: profile.bairro || "",
        cidade: profile.cidade || "",
        estado: profile.estado || "",
      });
    } else if (user) {
      setForm((prev) => ({ ...prev, email: user.email || "" }));
    }
  }, [profile, user]);

  // ─── ViaCEP ─────────────────────────────────────────────────────────────
  const fetchCep = useCallback(async (cepDigits: string) => {
    if (cepDigits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((prev) => ({
          ...prev,
          rua: data.logradouro || prev.rua,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
          estado: data.uf || prev.estado,
        }));
      }
    } catch {
      // silently ignore
    } finally {
      setCepLoading(false);
    }
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    let v = value;

    if (name === 'cpf') {
      v = maskCPF(value);
    } else if (name === 'phone') {
      v = maskPhone(value);
    } else if (name === 'cep') {
      v = maskCEP(value);
      const digits = value.replace(/\D/g, '');
      if (digits.length === 8) fetchCep(digits);
    } else if (name === 'numero') {
      v = v.replace(/\D/g, '').slice(0, 6);
    }

    setForm((prev) => ({ ...prev, [name]: v }));
    setMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    if (!user) {
      setMsg({ type: "error", text: "Sessão expirada. Faça login novamente." });
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("users")
      .update({
        fullName: form.fullName,
        cpf: form.cpf,
        email: form.email,
        birthDate: form.birthDate,
        phone: form.phone,
        gender: form.gender,
        cep: form.cep,
        rua: form.rua,
        numero: form.numero,
        complemento: form.complemento || null,
        bairro: form.bairro,
        cidade: form.cidade,
        estado: form.estado,
      })
      .eq("auth_id", user.id);

    if (error) {
      setMsg({ type: "error", text: "Erro ao salvar. Tente novamente." });
    } else {
      if (form.email !== user.email) {
        await supabase.auth.updateUser({ email: form.email });
      }
      await refreshProfile();
      setMsg({ type: "success", text: "Perfil atualizado com sucesso!" });
      setTimeout(() => onGoBack(), 1200);
    }

    setSaving(false);
  };

return (
    <div className="min-h-screen bg-gray-100 flex flex-col">

      {/* HEADER */}
      <header className="bg-white px-0 py-0 flex items-center shadow-sm flex-shrink-0">
        <img src="/AlugApp-Azul.png" alt="AlugApp" className="w-20 h-20" />
        <span className="text-2xl font-bold text-blue-600 -ml-2">AlugApp</span>
      </header>

      <div className="flex-1 overflow-y-auto pb-24 px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-4">

          {/* CARD DO PERFIL */}
          <div className="bg-white rounded-xl overflow-hidden shadow-sm">

            {/* Banner azul com botões */}
            <div className="h-24 bg-blue-700 flex items-start justify-between px-5 py-4">
              <button
                type="button"
                onClick={onGoBack}
                className="flex items-center gap-1.5 text-white text-sm font-medium hover:text-blue-200 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
              <button
                form="editar-form"
                type="submit"
                disabled={saving}
                className="bg-white text-blue-700 font-semibold text-sm px-5 py-1.5 rounded-lg hover:bg-blue-50 transition disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>

            {/* Avatar + título */}
            <div className="px-6 pb-5">
              <div className="relative inline-block -mt-9 mb-3">
                <div className="w-16 h-16 rounded-full border-4 border-white shadow bg-blue-100 flex items-center justify-center">
                  <User className="w-8 h-8 text-blue-600" />
                </div>
                <span className="absolute bottom-0.5 right-0 w-5 h-5 bg-blue-600 rounded-full border-2 border-white flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </span>
              </div>
              <p className="font-bold text-gray-900">Editar Perfil</p>
            </div>
          </div>

          {/* FORMULÁRIO */}
          <div className="bg-white rounded-xl shadow-sm p-6">

            {msg && (
              <div className={`mb-5 p-3 rounded-xl text-sm text-center font-medium ${
                msg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
              }`}>
                {msg.text}
              </div>
            )}

            <form id="editar-form" onSubmit={handleSave} className="space-y-4">

              {/* Nome Completo | CPF */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">
                    Nome Completo <span className="text-blue-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={form.fullName}
                    onChange={handleChange}
                    placeholder="Nome completo"
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">
                    CPF <span className="text-blue-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="cpf"
                    value={form.cpf}
                    onChange={handleChange}
                    placeholder="000.000.000-00"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              {/* E-mail | Data de Nascimento */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">
                    E-mail <span className="text-blue-600">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="E-mail"
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">
                    Data de Nascimento <span className="text-blue-600">*</span>
                  </label>
                  <input
                    type="date"
                    name="birthDate"
                    value={form.birthDate}
                    onChange={handleChange}
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              {/* Telefone | Gênero */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">
                    Telefone <span className="text-blue-600">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="(00) 00000-0000"
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">
                    Gênero <span className="text-blue-600">*</span>
                  </label>
                  <div className="relative">
                    <select
                      name="gender"
                      value={form.gender}
                      onChange={handleChange}
                      className={`${inputClass} appearance-none pr-10`}
                      required
                    >
                      <option value="">Selecione</option>
                      <option value="male">Masculino</option>
                      <option value="female">Feminino</option>
                      <option value="other">Outro</option>
                    </select>
                    <div className="absolute right-0 top-0 h-full w-10 bg-blue-700 rounded-r-lg flex items-center justify-center pointer-events-none">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── ENDEREÇO ──────────────────────────────────────────── */}
              <div className="border-t border-gray-200 pt-4 mt-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Endereço</p>

                {/* CEP | Rua */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">
                      CEP <span className="text-blue-600">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        name="cep"
                        value={form.cep}
                        onChange={handleChange}
                        placeholder="CEP"
                        className={inputClass}
                        required
                      />
                      {cepLoading && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />
                      )}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">
                      Rua / Logradouro <span className="text-blue-600">*</span>
                    </label>
                    <input
                      type="text"
                      name="rua"
                      value={form.rua}
                      onChange={handleChange}
                      placeholder="Rua / Logradouro"
                      className={inputClass}
                      required
                    />
                  </div>
                </div>

                {/* Número | Complemento | Bairro */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">
                      Número <span className="text-blue-600">*</span>
                    </label>
                    <input
                      type="text"
                      name="numero"
                      value={form.numero}
                      onChange={handleChange}
                      placeholder="Nº"
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Complemento</label>
                    <input
                      type="text"
                      name="complemento"
                      value={form.complemento}
                      onChange={handleChange}
                      placeholder="Apto, Bloco..."
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">
                      Bairro <span className="text-blue-600">*</span>
                    </label>
                    <input
                      type="text"
                      name="bairro"
                      value={form.bairro}
                      onChange={handleChange}
                      placeholder="Bairro"
                      className={inputClass}
                      required
                    />
                  </div>
                </div>

                {/* Cidade | Estado */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">
                      Cidade <span className="text-blue-600">*</span>
                    </label>
                    <input
                      type="text"
                      name="cidade"
                      value={form.cidade}
                      onChange={handleChange}
                      placeholder="Cidade"
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">
                      Estado <span className="text-blue-600">*</span>
                    </label>
                    <div className="relative">
                      <select
                        name="estado"
                        value={form.estado}
                        onChange={handleChange}
                        className={`${inputClass} appearance-none pr-10`}
                        required
                      >
                        <option value="">UF</option>
                        {UFS.map((uf) => (
                          <option key={uf} value={uf}>{uf}</option>
                        ))}
                      </select>
                      <div className="absolute right-0 top-0 h-full w-10 bg-blue-700 rounded-r-lg flex items-center justify-center pointer-events-none">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Biografia */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Biografia</label>
                <textarea
                  name="bio"
                  value={form.bio}
                  onChange={handleChange}
                  placeholder="Conte um pouco sobre você..."
                  className={`${inputClass} min-h-[100px] resize-none`}
                />
              </div>

            </form>
          </div>

        </div>
      </div>

      {/* BOTTOM NAV */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-16 flex justify-around items-center px-4 z-20">
        <button onClick={onGoHome} className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600 transition">
          <HomeIcon className="w-6 h-6" />
          <span className="text-xs">Início</span>
        </button>
        <button
          onClick={onGoToMyAnnouncements}
          className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600 transition"
        >
          <PlusCircle className="w-6 h-6" />
          <span className="text-xs">Meus Anúncios</span>
        </button>
        <button className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600 transition">
          <MessageSquare className="w-6 h-6" />
          <span className="text-xs">Chat</span>
        </button>
        <button onClick={onGoBack} className="flex flex-col items-center gap-0.5 text-blue-600">
          <User className="w-6 h-6" />
          <span className="text-xs font-medium">Perfil</span>
        </button>
      </nav>
    </div>
  );
}
