import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import {
  BarChart2, TrendingUp, TrendingDown,
  DollarSign, Package, Clock, Star, AlertCircle,
  CheckCircle, XCircle, Calendar, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

interface DashboardProps {
  onGoHome: () => void;
  onGoToPerfil: () => void;
  onGoToMyAnnouncements: () => void;
  onGoToChat: () => void;
}

interface Solicitacao {
  idsolicitacao: number;
  iditem: number;
  idlocador: number;
  idlocatario: number;
  data_inicio_prevista: string;
  data_fim_prevista: string;
  valor_total_previsto: number;
  status: string;
  item?: { nome: string; idcategoria: number; categoria?: { nome_categoria: string } };
  locador_user?: { fullName: string };
  locatario_user?: { fullName: string };
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("pt-BR");

const MESES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function BarChart({ data, color = "#3b82f6" }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-1 h-32 w-full">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
          <div className="relative w-full flex justify-center">
            <div
              className="w-full rounded-t-md transition-all duration-500 relative"
              style={{ height: `${Math.max((d.value / max) * 112, d.value > 0 ? 4 : 0)}px`, backgroundColor: color, opacity: 0.85 }}
            >
              {d.value > 0 && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[9px] px-1 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  {fmtBRL(d.value)}
                </div>
              )}
            </div>
          </div>
          <span className="text-[9px] text-gray-400 font-medium">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function KpiCard({ icon, label, value, sub, color, trend }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string; trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
        {trend === "up" && <ArrowUpRight className="w-4 h-4 text-green-500" />}
        {trend === "down" && <ArrowDownRight className="w-4 h-4 text-red-400" />}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pendente:   { label: "Pendente",   cls: "bg-yellow-100 text-yellow-700" },
    aprovado:   { label: "Aprovado",   cls: "bg-green-100 text-green-700" },
    rejeitado:  { label: "Rejeitado",  cls: "bg-red-100 text-red-600" },
    cancelado:  { label: "Cancelado",  cls: "bg-gray-100 text-gray-500" },
    concluido:  { label: "Concluído",  cls: "bg-blue-100 text-blue-700" },
  };
  const s = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-500" };
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.cls}`}>{s.label}</span>;
}

export default function Dashboard({ onGoHome, onGoToPerfil, onGoToMyAnnouncements, onGoToChat }: DashboardProps) {
  const { user, profile } = useAuth();
  const [view, setView] = useState<"locador" | "locatario">("locador");
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [totalItens, setTotalItens] = useState(0);
  const [mediaAvaliacao, setMediaAvaliacao] = useState<number | null>(null);
  const [locatariosMap, setLocatariosMap] = useState<Record<number, string>>({});

  const loadData = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      // Solicitações como locador
      if (view === "locador") {
        const { data: sols } = await supabase
          .from("solicitacao_aluguel")
          .select("*, item(nome, idcategoria, categoria(nome_categoria))")
          .eq("idlocador", profile.id)
          .order("idsolicitacao", { ascending: false });
        setSolicitacoes((sols as Solicitacao[]) ?? []);

        const { count } = await supabase
          .from("item")
          .select("iditem", { count: "exact", head: true })
          .eq("idlocador", user?.id);
        setTotalItens(count ?? 0);

        const { data: avals } = await supabase
          .from("avaliacao")
          .select("nota")
          .eq("idavaliado", profile.id);
        if (avals && avals.length > 0) {
          const avg = avals.reduce((s: number, r: any) => s + r.nota, 0) / avals.length;
          setMediaAvaliacao(Math.round(avg * 10) / 10);
        } else setMediaAvaliacao(null);
      } else {
        // Solicitações como locatário
        const { data: sols } = await supabase
          .from("solicitacao_aluguel")
          .select("*, item(nome, idcategoria, categoria(nome_categoria))")
          .eq("idlocatario", profile.id)
          .order("idsolicitacao", { ascending: false });
        setSolicitacoes((sols as Solicitacao[]) ?? []);
        setTotalItens(0);
        setMediaAvaliacao(null);
      }
    } finally {
      setLoading(false);
    }
  }, [profile?.id, view, user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (view !== "locador") return;
    const pendentes = solicitacoes.filter(s => s.status === "pendente");
    if (pendentes.length === 0) { setLocatariosMap({}); return; }
    const ids = Array.from(new Set(pendentes.map(s => s.idlocatario)));
    supabase.from("users").select("id, fullName").in("id", ids).then(({ data }) => {
      const map: Record<number, string> = {};
      data?.forEach((u: any) => { map[u.id] = u.fullName; });
      setLocatariosMap(map);
    });
  }, [solicitacoes, view]);

  // ── Derivações ───────────────────────────────────────────────────────────────
  const ativas = ["aprovado", "concluido"];
  const solAtivas = solicitacoes.filter(s => ativas.includes(s.status));
  const solDoAno = solAtivas.filter(s => new Date(s.data_inicio_prevista + "T12:00:00").getFullYear() === year);

  const faturamentoTotal = solAtivas.reduce((s, r) => s + Number(r.valor_total_previsto), 0);
  const faturamentoAno   = solDoAno.reduce((s, r) => s + Number(r.valor_total_previsto), 0);

  const diasTotais = solAtivas.reduce((acc, s) => {
    const d = Math.ceil((new Date(s.data_fim_prevista).getTime() - new Date(s.data_inicio_prevista).getTime()) / 86400000);
    return acc + (d > 0 ? d : 0);
  }, 0);
  const mediaDias = solAtivas.length > 0 ? (diasTotais / solAtivas.length).toFixed(1) : "0";
  const mediaTicket = solAtivas.length > 0 ? faturamentoTotal / solAtivas.length : 0;

  const solPendentes = solicitacoes.filter(s => s.status === "pendente");
  const pendentes  = solPendentes.length;
  const aprovadas  = solicitacoes.filter(s => s.status === "aprovado").length;
  const rejeitadas = solicitacoes.filter(s => s.status === "rejeitado").length;
  const concluidas = solicitacoes.filter(s => s.status === "concluido").length;
  const taxaAprov  = solicitacoes.length > 0
    ? Math.round(((aprovadas + concluidas) / solicitacoes.length) * 100)
    : 0;

  // Mensal do ano selecionado
  const porMes = Array.from({ length: 12 }, (_, m) => {
    const val = solDoAno
      .filter(s => new Date(s.data_inicio_prevista + "T12:00:00").getMonth() === m)
      .reduce((acc, s) => acc + Number(s.valor_total_previsto), 0);
    return { label: MESES_ABREV[m], value: val };
  });

  // Categorias
  const catMap: Record<string, number> = {};
  solAtivas.forEach(s => {
    const cat = (s.item as any)?.categoria?.nome_categoria ?? "Outros";
    catMap[cat] = (catMap[cat] ?? 0) + Number(s.valor_total_previsto);
  });
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const catMax = topCats[0]?.[1] ?? 1;

  const anos = Array.from(new Set(solicitacoes.map(s => new Date(s.data_inicio_prevista + "T12:00:00").getFullYear()))).sort((a, b) => b - a);
  if (!anos.includes(new Date().getFullYear())) anos.unshift(new Date().getFullYear());

  const recentes = [...solicitacoes].slice(0, 6);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* HEADER */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {anos.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* TOGGLE LOCADOR / LOCATÁRIO */}
        <div className="max-w-6xl mx-auto px-4 pb-3">
          <div className="flex bg-gray-100 rounded-xl p-1 w-fit">
            <button
              onClick={() => setView("locador")}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${view === "locador" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              🏠 Locador
            </button>
            <button
              onClick={() => setView("locatario")}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${view === "locatario" ? "bg-white text-purple-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              🛒 Locatário
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-200 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            {/* ── NOTIFICAÇÕES LOCADOR ─────────────────────────────────── */}
            {view === "locador" && solPendentes.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <h3 className="font-bold text-yellow-800 text-sm">
                      {solPendentes.length} pedido{solPendentes.length > 1 ? "s" : ""} aguardando sua resposta
                    </h3>
                  </div>
                  <button
                    onClick={onGoToChat}
                    className="text-xs font-semibold text-yellow-700 bg-yellow-100 hover:bg-yellow-200 px-3 py-1.5 rounded-lg transition"
                  >
                    Ver no Chat →
                  </button>
                </div>
                <div className="space-y-2">
                  {solPendentes.map(s => (
                    <div
                      key={s.idsolicitacao}
                      className="bg-white rounded-xl p-3 border border-yellow-100 flex items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {(s.item as any)?.nome ?? `Item #${s.iditem}`}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {locatariosMap[s.idlocatario] ? (
                            <span className="font-medium text-gray-700">{locatariosMap[s.idlocatario]} · </span>
                          ) : null}
                          {fmtDate(s.data_inicio_prevista)} → {fmtDate(s.data_fim_prevista)}
                        </p>
                        <p className="text-xs font-bold text-blue-700 mt-0.5">
                          {fmtBRL(Number(s.valor_total_previsto))}
                        </p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700 flex-shrink-0 border border-yellow-200">
                        Pendente
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── NOTIFICAÇÕES LOCATÁRIO ───────────────────────────────── */}
            {view === "locatario" && solPendentes.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <p className="text-sm font-semibold text-blue-800">
                    Você tem {solPendentes.length} pedido{solPendentes.length > 1 ? "s" : ""} aguardando resposta do locador.
                  </p>
                </div>
                <button
                  onClick={onGoToChat}
                  className="text-xs font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-lg transition flex-shrink-0"
                >
                  Ver no Chat →
                </button>
              </div>
            )}

            {/* ── KPIs LOCADOR ─────────────────────────────────────────── */}
            {view === "locador" && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard icon={<DollarSign className="w-5 h-5 text-green-700" />} label="Faturamento Total" value={fmtBRL(faturamentoTotal)} color="bg-green-100" trend="up" />
                  <KpiCard icon={<TrendingUp className="w-5 h-5 text-blue-700" />} label={`Faturamento ${year}`} value={fmtBRL(faturamentoAno)} color="bg-blue-100" trend="up" />
                  <KpiCard icon={<Package className="w-5 h-5 text-indigo-700" />} label="Itens Anunciados" value={String(totalItens)} color="bg-indigo-100" trend="neutral" />
                  <KpiCard icon={<BarChart2 className="w-5 h-5 text-violet-700" />} label="Total de Aluguéis" value={String(solicitacoes.length)} color="bg-violet-100" trend="neutral" />
                  <KpiCard icon={<Clock className="w-5 h-5 text-orange-600" />} label="Média Dias/Aluguel" value={`${mediaDias} dias`} color="bg-orange-100" trend="neutral" />
                  <KpiCard icon={<DollarSign className="w-5 h-5 text-teal-700" />} label="Ticket Médio" value={fmtBRL(mediaTicket)} color="bg-teal-100" trend="neutral" />
                  <KpiCard icon={<Star className="w-5 h-5 text-yellow-600" />} label="Avaliação Média" value={mediaAvaliacao !== null ? `${mediaAvaliacao} ★` : "—"} color="bg-yellow-100" trend="neutral" />
                  <KpiCard icon={<CheckCircle className="w-5 h-5 text-green-700" />} label="Taxa de Aprovação" value={`${taxaAprov}%`} sub={`${aprovadas + concluidas} de ${solicitacoes.length}`} color="bg-green-100" trend={taxaAprov >= 70 ? "up" : "down"} />
                </div>

                {/* Status cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Pendentes",  count: pendentes,  icon: <AlertCircle className="w-4 h-4" />, cls: "bg-yellow-50 border-yellow-200 text-yellow-700" },
                    { label: "Aprovados",  count: aprovadas,  icon: <CheckCircle className="w-4 h-4" />, cls: "bg-green-50 border-green-200 text-green-700" },
                    { label: "Concluídos", count: concluidas, icon: <CheckCircle className="w-4 h-4" />, cls: "bg-blue-50 border-blue-200 text-blue-700" },
                    { label: "Rejeitados", count: rejeitadas, icon: <XCircle className="w-4 h-4" />,    cls: "bg-red-50 border-red-200 text-red-600" },
                  ].map(s => (
                    <div key={s.label} className={`border rounded-xl p-3 flex items-center gap-3 ${s.cls}`}>
                      {s.icon}
                      <div>
                        <p className="text-lg font-bold leading-none">{s.count}</p>
                        <p className="text-xs mt-0.5 opacity-80">{s.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── KPIs LOCATÁRIO ─────────────────────────────────────────── */}
            {view === "locatario" && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard icon={<TrendingDown className="w-5 h-5 text-rose-700" />} label="Total Gasto" value={fmtBRL(faturamentoTotal)} color="bg-rose-100" trend="neutral" />
                  <KpiCard icon={<Calendar className="w-5 h-5 text-purple-700" />} label={`Gasto em ${year}`} value={fmtBRL(faturamentoAno)} color="bg-purple-100" trend="neutral" />
                  <KpiCard icon={<BarChart2 className="w-5 h-5 text-blue-700" />} label="Aluguéis Realizados" value={String(solAtivas.length)} color="bg-blue-100" trend="neutral" />
                  <KpiCard icon={<Clock className="w-5 h-5 text-orange-600" />} label="Média Dias/Aluguel" value={`${mediaDias} dias`} color="bg-orange-100" trend="neutral" />
                  <KpiCard icon={<DollarSign className="w-5 h-5 text-teal-700" />} label="Gasto Médio/Aluguel" value={fmtBRL(mediaTicket)} color="bg-teal-100" trend="neutral" />
                  <KpiCard icon={<AlertCircle className="w-5 h-5 text-yellow-600" />} label="Pendentes" value={String(pendentes)} color="bg-yellow-100" trend="neutral" />
                  <KpiCard icon={<CheckCircle className="w-5 h-5 text-green-700" />} label="Aprovados" value={String(aprovadas)} color="bg-green-100" trend="neutral" />
                  <KpiCard icon={<XCircle className="w-5 h-5 text-red-600" />} label="Rejeitados" value={String(rejeitadas)} color="bg-red-100" trend="neutral" />
                </div>
              </>
            )}

            {/* ── GRÁFICO MENSAL ─────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900">
                    {view === "locador" ? "Faturamento Mensal" : "Gastos Mensais"} — {year}
                  </h3>
                  <p className="text-sm text-gray-400 mt-0.5">
                    Total: <span className="font-semibold text-gray-700">{fmtBRL(faturamentoAno)}</span>
                  </p>
                </div>
              </div>
              <BarChart data={porMes} color={view === "locador" ? "#3b82f6" : "#a855f7"} />
            </div>

            {/* ── CATEGORIAS + RECENTES ─────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Categorias */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-bold text-gray-900 mb-4">
                  {view === "locador" ? "Faturamento por Categoria" : "Gastos por Categoria"}
                </h3>
                {topCats.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-6">Nenhum dado disponível</p>
                ) : (
                  <div className="space-y-3">
                    {topCats.map(([cat, val]) => (
                      <div key={cat}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700 truncate">{cat}</span>
                          <span className="text-gray-500 font-semibold ml-2">{fmtBRL(val)}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${view === "locador" ? "bg-blue-500" : "bg-purple-500"}`}
                            style={{ width: `${(val / catMax) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Transações recentes */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-bold text-gray-900 mb-4">Solicitações Recentes</h3>
                {recentes.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-6">Nenhuma solicitação encontrada</p>
                ) : (
                  <div className="space-y-2.5">
                    {recentes.map(s => (
                      <div key={s.idsolicitacao} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <Package className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            {(s.item as any)?.nome ?? `Item #${s.iditem}`}
                          </p>
                          <p className="text-xs text-gray-400">
                            {fmtDate(s.data_inicio_prevista)} → {fmtDate(s.data_fim_prevista)}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-gray-900">{fmtBRL(Number(s.valor_total_previsto))}</p>
                          <StatusBadge status={s.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── VISÃO ANUAL ──────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-gray-900 mb-4">Resumo por Ano</h3>
              {anos.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">Nenhum dado</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 text-xs font-semibold border-b border-gray-100">
                        <th className="pb-2 pr-4">Ano</th>
                        <th className="pb-2 pr-4">Solicitações</th>
                        <th className="pb-2 pr-4">Aprovadas</th>
                        <th className="pb-2 pr-4">Valor Total</th>
                        <th className="pb-2">Ticket Médio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {anos.map(y => {
                        const ySols = solicitacoes.filter(s => new Date(s.data_inicio_prevista + "T12:00:00").getFullYear() === y);
                        const yAtivas = ySols.filter(s => ativas.includes(s.status));
                        const yTotal = yAtivas.reduce((acc, s) => acc + Number(s.valor_total_previsto), 0);
                        const yTicket = yAtivas.length > 0 ? yTotal / yAtivas.length : 0;
                        return (
                          <tr key={y} className={`border-b border-gray-50 hover:bg-gray-50 transition ${y === year ? "font-semibold" : ""}`}>
                            <td className="py-2.5 pr-4">
                              <span className={`${y === year ? "text-blue-600" : "text-gray-700"}`}>{y}</span>
                              {y === year && <span className="ml-2 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">atual</span>}
                            </td>
                            <td className="py-2.5 pr-4 text-gray-600">{ySols.length}</td>
                            <td className="py-2.5 pr-4 text-green-600">{yAtivas.length}</td>
                            <td className="py-2.5 pr-4 text-gray-900">{fmtBRL(yTotal)}</td>
                            <td className="py-2.5 text-gray-500">{fmtBRL(yTicket)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </>
        )}
      </div>

    </div>
  );
}
