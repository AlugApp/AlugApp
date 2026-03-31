import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Star,
  Edit2,
  Package,
  HelpCircle,
  LogOut,
  ShieldCheck,
  Bell,
  Shield,
  CreditCard,
  Home as HomeIcon,
  Search,
  PlusCircle,
  MessageSquare,
  User,
  Eye,
  EyeOff,
  X,
} from "lucide-react";

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_TOKEN!
);

type Tab = "informacoes" | "seguranca" | "pagamentos";

interface PerfilProps {
  onGoBack: () => void;
  onLogout: () => void;
  onGoToEditar: () => void;
}

export default function Perfil({ onGoBack, onLogout, onGoToEditar }: PerfilProps) {
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("informacoes");

  // Modal alterar senha
  const [showSenha, setShowSenha] = useState(false);
  const [senhaForm, setSenhaForm] = useState({ atual: "", nova: "", confirmar: "" });
  const [showAtual, setShowAtual] = useState(false);
  const [showNova, setShowNova] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [senhaLoading, setSenhaLoading] = useState(false);
  const [senhaMsg, setSenhaMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("loggedUser");
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("loggedUser");
    onLogout();
  };

  const handleAlterarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setSenhaMsg(null);

    if (senhaForm.nova !== senhaForm.confirmar) {
      setSenhaMsg({ type: "error", text: "As senhas novas não coincidem." });
      return;
    }
    if (senhaForm.nova.length < 6) {
      setSenhaMsg({ type: "error", text: "A nova senha deve ter pelo menos 6 caracteres." });
      return;
    }
    if (!/[A-Z]/.test(senhaForm.nova) || !/[0-9]/.test(senhaForm.nova)) {
      setSenhaMsg({ type: "error", text: "A nova senha deve ter pelo menos 1 letra maiúscula e 1 número." });
      return;
    }

    setSenhaLoading(true);
    try {
      // Verificar senha atual
      const { data: found, error: findError } = await supabase
        .from("users")
        .select("id")
        .eq("email", user.email)
        .eq("password", senhaForm.atual)
        .maybeSingle();

      if (findError || !found) {
        setSenhaMsg({ type: "error", text: "Senha atual incorreta." });
        return;
      }

      // Atualizar senha
      const { error: updateError } = await supabase
        .from("users")
        .update({ password: senhaForm.nova })
        .eq("id", found.id);

      if (updateError) {
        setSenhaMsg({ type: "error", text: "Erro ao atualizar. Tente novamente." });
        return;
      }

      setSenhaMsg({ type: "success", text: "Senha alterada com sucesso!" });
      setSenhaForm({ atual: "", nova: "", confirmar: "" });
      setTimeout(() => setShowSenha(false), 1500);
    } finally {
      setSenhaLoading(false);
    }
  };

  const tabLabels: Record<Tab, string> = {
    informacoes: "Informações",
    seguranca: "Segurança",
    pagamentos: "Pagamentos",
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">

      {/* HEADER */}
      <header className="bg-white px-0 py-0 flex items-center shadow-sm flex-shrink-0">
        <img src="/AlugApp-Azul.png" alt="AlugApp" className="w-20 h-20" />
        <span className="text-2xl font-bold text-blue-600 -ml-0">AlugApp</span>
      </header>

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto pb-24 px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-4">

          {/* PROFILE CARD */}
          <div className="bg-white rounded-xl overflow-hidden shadow-sm">

            {/* Blue banner */}
            <div className="h-24 bg-blue-700" />

            {/* Avatar + Info */}
            <div className="px-6 pb-5 relative">

              {/* Avatar overlapping banner */}
              <div className="relative inline-block -mt-9 mb-3">
                <div className="w-16 h-16 rounded-full border-4 border-white shadow bg-blue-100 flex items-center justify-center">
                  <User className="w-8 h-8 text-blue-600" />
                </div>
                <span className="absolute bottom-0.5 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
              </div>

              {/* Edit button — top right */}
              <button
                onClick={onGoToEditar}
                className="absolute top-4 right-6 flex items-center gap-1.5 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Editar Perfil
              </button>

              {/* Name + member since */}
              <h2 className="text-lg font-bold text-gray-900">{user?.fullName || "Usuário"}</h2>
              <p className="text-sm text-gray-500 mb-4">Membro desde Março/2024</p>

              {/* Stats */}
              <div className="flex gap-8 text-sm">
                <div>
                  <div className="flex items-center gap-1 font-bold text-gray-900">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    4.8
                  </div>
                  <p className="text-gray-400 text-xs">Avaliação</p>
                </div>
                <div>
                  <p className="font-bold text-gray-900">12</p>
                  <p className="text-gray-400 text-xs">Aluguéis</p>
                </div>
                <div>
                  <p className="font-bold text-gray-900">3</p>
                  <p className="text-gray-400 text-xs">Itens</p>
                </div>
              </div>
            </div>

            {/* TABS */}
            <div className="border-t flex text-sm font-medium">
              {(["informacoes", "seguranca", "pagamentos"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-3 border-b-2 transition ${
                    tab === t
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tabLabels[t]}
                </button>
              ))}
            </div>

            {/* TAB CONTENT */}
            <div className="px-6 py-5">

              {/* INFORMAÇÕES */}
              {tab === "informacoes" && (
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs mb-0.5">E-mail</p>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-800">{user?.email || "—"}</span>
                      <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                        Verificado
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs mb-0.5">Telefone</p>
                    <span className="text-gray-800">{user?.phone || "—"}</span>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs mb-0.5">Apartamento/Bloco</p>
                    <span className="text-gray-800">
                      {user?.apartment && user?.block
                        ? `Apto ${user.apartment} - Bloco ${user.block}`
                        : user?.address || "—"}
                    </span>
                  </div>
                </div>
              )}

              {/* PAGAMENTOS */}
              {tab === "pagamentos" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 border rounded-xl px-4 py-3 text-sm">
                    <CreditCard className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-800">Cartão de Crédito</p>
                      <p className="text-gray-400 text-xs tracking-widest">**** **** **** 4321</p>
                    </div>
                  </div>
                  <button className="w-full bg-blue-600 text-white rounded-xl py-3 flex items-center justify-center gap-2 font-semibold hover:bg-blue-700 transition text-sm">
                    <CreditCard className="w-5 h-5" />
                    Adicionar Novo Cartão
                  </button>
                </div>
              )}

              {/* SEGURANÇA */}
              {tab === "seguranca" && (
                <div className="space-y-2">
                  <button
                    onClick={() => { setSenhaMsg(null); setSenhaForm({ atual: "", nova: "", confirmar: "" }); setShowSenha(true); }}
                    className="w-full flex items-center gap-3 border rounded-xl px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition"
                  >
                    <Shield className="w-5 h-5 text-gray-500" />
                    Alterar Senha
                  </button>
                  <button className="w-full flex items-center gap-3 border rounded-xl px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition">
                    <Bell className="w-5 h-5 text-gray-500" />
                    Notificações
                  </button>
                  <button className="w-full flex items-center justify-between gap-3 border rounded-xl px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="w-5 h-5 text-gray-500" />
                      Verificação em Duas Etapas
                    </div>
                    <span className="text-blue-600 font-semibold">Ativado</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* AÇÕES RÁPIDAS */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h3 className="font-bold text-gray-900">Ações Rápidas</h3>
            </div>
            <div className="divide-y">
              <button className="w-full flex items-center gap-3 px-5 py-4 text-sm text-gray-700 hover:bg-gray-50 transition">
                <Package className="w-5 h-5 text-gray-500" />
                Histórico de Aluguéis
              </button>
              <button className="w-full flex items-center gap-3 px-5 py-4 text-sm text-gray-700 hover:bg-gray-50 transition">
                <HelpCircle className="w-5 h-5 text-gray-500" />
                Central de Ajuda
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-5 py-4 text-sm text-red-600 bg-red-50 hover:bg-red-100 transition"
              >
                <LogOut className="w-5 h-5" />
                Sair da Conta
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* MODAL ALTERAR SENHA */}
      {showSenha && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">

            {/* Header do modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Alterar Senha</h2>
              <button onClick={() => setShowSenha(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAlterarSenha} className="px-6 py-5 space-y-4">

              {/* Feedback */}
              {senhaMsg && (
                <div className={`p-3 rounded-xl text-sm text-center font-medium ${
                  senhaMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                }`}>
                  {senhaMsg.text}
                </div>
              )}

              {/* Senha atual */}
              <div className="relative">
                <input
                  type={showAtual ? "text" : "password"}
                  placeholder="Senha atual"
                  value={senhaForm.atual}
                  onChange={(e) => setSenhaForm({ ...senhaForm, atual: e.target.value })}
                  required
                  disabled={senhaLoading}
                  className="w-full bg-gray-100 rounded-xl px-4 py-3 pr-10 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="button" tabIndex={-1} onClick={() => setShowAtual(!showAtual)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600">
                  {showAtual ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Nova senha */}
              <div className="relative">
                <input
                  type={showNova ? "text" : "password"}
                  placeholder="Nova senha"
                  value={senhaForm.nova}
                  onChange={(e) => setSenhaForm({ ...senhaForm, nova: e.target.value })}
                  required
                  disabled={senhaLoading}
                  className="w-full bg-gray-100 rounded-xl px-4 py-3 pr-10 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="button" tabIndex={-1} onClick={() => setShowNova(!showNova)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600">
                  {showNova ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Confirmar nova senha */}
              <div className="relative">
                <input
                  type={showConfirmar ? "text" : "password"}
                  placeholder="Confirmar nova senha"
                  value={senhaForm.confirmar}
                  onChange={(e) => setSenhaForm({ ...senhaForm, confirmar: e.target.value })}
                  required
                  disabled={senhaLoading}
                  className="w-full bg-gray-100 rounded-xl px-4 py-3 pr-10 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="button" tabIndex={-1} onClick={() => setShowConfirmar(!showConfirmar)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600">
                  {showConfirmar ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <p className="text-xs text-gray-400">Mínimo 6 caracteres, 1 maiúscula e 1 número.</p>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowSenha(false)}
                  className="flex-1 border rounded-xl py-2.5 text-sm text-gray-700 font-medium hover:bg-gray-50 transition">
                  Cancelar
                </button>
                <button type="submit" disabled={senhaLoading}
                  className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60">
                  {senhaLoading ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BOTTOM NAV */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-16 flex justify-around items-center px-4 z-20">
        <button onClick={onGoBack} className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600 transition">
          <HomeIcon className="w-6 h-6" />
          <span className="text-xs">Início</span>
        </button>
        <button className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600 transition">
          <Search className="w-6 h-6" />
          <span className="text-xs">Buscar</span>
        </button>
        <button className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600 transition">
          <PlusCircle className="w-6 h-6" />
          <span className="text-xs">Meus Anúncios</span>
        </button>
        <button className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600 transition">
          <MessageSquare className="w-6 h-6" />
          <span className="text-xs">Chat</span>
        </button>
        <button className="flex flex-col items-center gap-0.5 text-blue-600">
          <User className="w-6 h-6" />
          <span className="text-xs font-medium">Perfil</span>
        </button>
      </nav>
    </div>
  );
}
