import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { useGeolocation } from "../hooks/useGeolocation";
import { haversineKm } from "../lib/geocoding";
import {
  Package, Search, SlidersHorizontal, X, CirclePlus, Bell,
  MapPin, LocateFixed, Loader2,
} from "lucide-react";


interface HomeProps {
  onGoToAnnounce: () => void;
  onGoToPerfil: () => void;
  onGoToMyAnnouncements: () => void;
  onOpenItem: (id: number) => void;
  onGoToDashboard: () => void;
  onGoToChat: () => void;
}

interface Item {
  iditem: number;
  nome: string;
  descricao: string;
  valor_aluguel_diario: number;
  valor_aluguel_semana: number;
  valor_aluguel_mensal: number;
  idcategoria: number;
  foto_url?: string | null;
  nome_categoria?: string;
  created_at?: string;
  locador_nome?: string;
  locador_apto?: string;
  locador_bloco?: string;
  latitude?: number | null;
  longitude?: number | null;
}

type Periodo = "diario" | "semanal" | "mensal";
type Ordenacao = "recente" | "preco_asc" | "preco_desc" | "az";

const CAMPO_PRECO: Record<Periodo, keyof Item> = {
  diario: "valor_aluguel_diario",
  semanal: "valor_aluguel_semana",
  mensal: "valor_aluguel_mensal",
};

const LABEL_PRECO: Record<Periodo, string> = {
  diario: "dia",
  semanal: "semana",
  mensal: "mês",
};

interface Categoria {
  idcategoria: number;
  nome_categoria: string;
}

const RAIOS_KM = [1, 3, 5, 10] as const;

export default function Home({ onGoToAnnounce, onGoToPerfil, onGoToMyAnnouncements, onOpenItem, onGoToDashboard, onGoToChat }: HomeProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();
  const [notificacoesCount, setNotificacoesCount] = useState(0);
  const [showNotifPopup, setShowNotifPopup]       = useState(false);
  const [notifItems, setNotifItems]               = useState<{ id: number; nome: string; item: string }[]>([]);
  const [notifLoading, setNotifLoading]           = useState(false);
  const notifRef                                  = useRef<HTMLDivElement>(null);
  const scrollRestoredRef                         = useRef(false);

  const { latitude: userLat, longitude: userLon, loading: locLoading, error: locError, requestLocation, clearLocation } = useGeolocation();

  const [categoryFilter, setCategoryFilter] = useState(() => sessionStorage.getItem("h_cat") || "todas");
  const [searchText, setSearchText] = useState(() => sessionStorage.getItem("h_search") || "");
  const [periodo, setPeriodo] = useState<Periodo>(() => (sessionStorage.getItem("h_periodo") as Periodo) || "diario");
  const [precoMin, setPrecoMin] = useState(() => sessionStorage.getItem("h_precoMin") || "");
  const [precoMax, setPrecoMax] = useState(() => sessionStorage.getItem("h_precoMax") || "");
  const [dataInicio, setDataInicio] = useState(() => sessionStorage.getItem("h_dataInicio") || "");
  const [dataFim, setDataFim] = useState(() => sessionStorage.getItem("h_dataFim") || "");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>(() => (sessionStorage.getItem("h_ordenacao") as Ordenacao) || "recente");
  const [showFiltros, setShowFiltros] = useState(false);
  const [proximoRaio, setProximoRaio] = useState<number | null>(() => {
    const saved = sessionStorage.getItem("h_proximoRaio");
    return saved ? Number(saved) : null;
  });

  const campoPrecoDB: Record<Periodo, string> = {
    diario: "valor_aluguel_diario",
    semanal: "valor_aluguel_semana",
    mensal: "valor_aluguel_mensal",
  };

  const loadItems = async () => {
    setLoading(true);

    let query = supabase.from("item").select("*, categoria(nome_categoria)").neq("disponivel", false);

    if (categoryFilter !== "todas") query = query.eq("idcategoria", Number(categoryFilter));
    if (searchText.trim()) query = query.or(`nome.ilike.%${searchText.trim()}%,descricao.ilike.%${searchText.trim()}%`);

    const campoPreco = campoPrecoDB[periodo];
    if (precoMin !== "") query = (query as any).gte(campoPreco, Number(precoMin));
    if (precoMax !== "") query = (query as any).lte(campoPreco, Number(precoMax));
    if (dataInicio) query = query.gte("created_at", dataInicio);
    if (dataFim) query = query.lte("created_at", `${dataFim}T23:59:59`);

    switch (ordenacao) {
      case "recente": query = query.order("created_at", { ascending: false }); break;
      case "preco_asc": query = (query as any).order(campoPreco, { ascending: true }); break;
      case "preco_desc": query = (query as any).order(campoPreco, { ascending: false }); break;
      case "az": query = query.order("nome", { ascending: true }); break;
    }

    const { data: itemsData, error } = await query;
    if (error || !itemsData) { setLoading(false); return; }

    const { data: fotos } = await supabase
      .from("fotoitem").select("*").order("ordem_exibicao", { ascending: true });

    const itemsWithPhotos = itemsData.map((item: any) => {
      const foto = fotos?.find((f) => f.iditem === item.iditem);
      return {
        ...item,
        foto_url: foto?.url_foto ?? null,
        nome_categoria: item.categoria?.nome_categoria,
      };
    });

    setItems(itemsWithPhotos);
    setLoading(false);
  };

  // Filtragem de proximidade client-side sobre os itens já carregados
  const proximityActive = !!(proximoRaio && userLat != null && userLon != null);

  const displayedItems = useMemo(() => {
    if (!proximityActive) return items;
    return items.filter(item => {
      if (item.latitude == null || item.longitude == null) return false;
      const dist = haversineKm(userLat!, userLon!, item.latitude, item.longitude);
      return dist <= proximoRaio!;
    });
  }, [items, proximoRaio, userLat, userLon, proximityActive]);

  // Itens ocultados por não terem coordenadas (criados antes da migração / sem GPS)
  const itensSemCoordenadas = useMemo(
    () => (proximityActive ? items.filter(i => i.latitude == null || i.longitude == null).length : 0),
    [items, proximityActive]
  );

  const fetchNotifCount = useCallback(() => {
    if (!profile?.id) return;
    supabase
      .from("solicitacao_aluguel")
      .select("idsolicitacao", { count: "exact", head: true })
      .eq("idlocador", profile.id)
      .eq("status", "pendente")
      .then(({ count }) => setNotificacoesCount(count || 0));
  }, [profile?.id]);

  useEffect(() => { fetchNotifCount(); }, [fetchNotifCount]);

  const handleBellClick = async () => {
    if (showNotifPopup) { setShowNotifPopup(false); return; }
    setShowNotifPopup(true);
    if (notifItems.length > 0 || notifLoading) return;
    setNotifLoading(true);
    const { data: sols } = await supabase
      .from("solicitacao_aluguel").select("idsolicitacao, iditem, idlocatario")
      .eq("idlocador", profile?.id).eq("status", "pendente")
      .order("idsolicitacao", { ascending: false });
    if (!sols || sols.length === 0) { setNotifItems([]); setNotifLoading(false); return; }
    const [itemsRes, usersRes] = await Promise.all([
      supabase.from("item").select("iditem, nome").in("iditem", sols.map((s: any) => s.iditem)),
      supabase.from("users").select("id, fullName").in("id", sols.map((s: any) => s.idlocatario)),
    ]);
    setNotifItems(sols.map((s: any) => ({
      id: s.idsolicitacao,
      nome: usersRes.data?.find((u: any) => u.id === s.idlocatario)?.fullName ?? "Alguém",
      item: itemsRes.data?.find((i: any) => i.iditem === s.iditem)?.nome ?? "item",
    })));
    setNotifLoading(false);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setShowNotifPopup(false);
    };
    if (showNotifPopup) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNotifPopup]);

  useEffect(() => {
    supabase.from("categoria").select("*").order("nome_categoria").then(({ data }) => {
      if (data) setCategorias(data);
    });
  }, []);

  // Restaura a posição de rolagem apenas ao voltar da tela de detalhes de um item.
  // Qualquer outra navegação (trocar de aba e voltar) deve começar do topo.
  useEffect(() => {
    if (loading || scrollRestoredRef.current) return;
    scrollRestoredRef.current = true;
    const pending = sessionStorage.getItem("h_scrollY_pending");
    const saved = sessionStorage.getItem("h_scrollY");
    sessionStorage.removeItem("h_scrollY_pending");
    sessionStorage.removeItem("h_scrollY");
    if (pending === "1" && saved) {
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, Number(saved))));
    } else {
      window.scrollTo(0, 0);
    }
  }, [loading]);

  useEffect(() => {
    sessionStorage.setItem("h_cat", categoryFilter);
    sessionStorage.setItem("h_search", searchText);
    sessionStorage.setItem("h_periodo", periodo);
    sessionStorage.setItem("h_precoMin", precoMin);
    sessionStorage.setItem("h_precoMax", precoMax);
    sessionStorage.setItem("h_dataInicio", dataInicio);
    sessionStorage.setItem("h_dataFim", dataFim);
    sessionStorage.setItem("h_ordenacao", ordenacao);
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, searchText, periodo, precoMin, precoMax, dataInicio, dataFim, ordenacao]);

  useEffect(() => {
    if (proximoRaio !== null) {
      sessionStorage.setItem("h_proximoRaio", String(proximoRaio));
    } else {
      sessionStorage.removeItem("h_proximoRaio");
    }
  }, [proximoRaio]);

  // Quando o filtro de proximidade é ativado com sessão anterior salva, pede a localização
  useEffect(() => {
    if (proximoRaio && userLat == null && !locLoading) {
      requestLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const temFiltroAtivo = !!(searchText || precoMin || precoMax || dataInicio || dataFim || categoryFilter !== "todas" || proximoRaio);

  const limparFiltros = () => {
    setSearchText(""); setPrecoMin(""); setPrecoMax("");
    setDataInicio(""); setDataFim("");
    setCategoryFilter("todas"); setOrdenacao("recente"); setPeriodo("diario");
    setProximoRaio(null); clearLocation();
    ["h_cat","h_search","h_periodo","h_precoMin","h_precoMax","h_dataInicio","h_dataFim","h_ordenacao","h_proximoRaio"].forEach(k => sessionStorage.removeItem(k));
  };

  const ativarProximidade = (raio: number) => {
    setProximoRaio(raio);
    requestLocation();
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">

      {/* HEADER */}
      <header className="bg-white px-4 py-3 md:px-0 md:py-0 flex justify-between items-center shadow-sm md:pr-4">
        <div className="flex items-center">
          <img src="/AlugApp-Azul.png" alt="AlugApp" className="w-10 h-10 md:w-20 md:h-20" />
          <span className="text-lg md:text-2xl font-bold text-blue-600 ml-1 md:-ml-0">AlugApp</span>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          {/* SINO DE NOTIFICAÇÕES */}
          <div className="relative" ref={notifRef}>
            <button
              className="relative text-gray-400 hover:text-blue-600 transition p-1 -m-1"
              onClick={handleBellClick}
            >
              <Bell className="w-6 h-6" />
              {notificacoesCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                  {notificacoesCount}
                </span>
              )}
            </button>

            {showNotifPopup && (
              <div className="fixed top-16 right-4 left-4 md:absolute md:top-full md:right-0 md:left-auto md:mt-2 md:w-72 w-auto bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 pt-3 pb-1">
                  Pedidos pendentes
                </p>
                {notifLoading ? (
                  <div className="px-4 pb-3 space-y-2">
                    {[1, 2].map(i => (
                      <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
                    ))}
                  </div>
                ) : notifItems.length === 0 ? (
                  <p className="text-xs text-gray-400 px-4 pb-4 pt-1">Nenhum pedido pendente.</p>
                ) : (
                  <ul className="pb-1">
                    {notifItems.map(n => (
                      <li key={n.id} className="px-4 py-2 text-sm text-gray-700 border-b border-gray-50 last:border-0">
                        <span className="font-semibold text-gray-900">{n.nome}</span>
                        <span className="text-gray-400"> solicitou </span>
                        {n.item}
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  onClick={() => { setShowNotifPopup(false); onGoToChat(); }}
                  className="w-full py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition border-t border-gray-100"
                >
                  Ver no Chat →
                </button>
              </div>
            )}
          </div>
          <button
            onClick={onGoToAnnounce}
            aria-label="Anunciar Item"
            className="flex items-center gap-2 bg-blue-700 text-white p-2.5 sm:px-5 sm:py-2.5 rounded-full font-semibold text-sm hover:bg-blue-800 active:bg-blue-900 transition"
          >
            <CirclePlus className="w-5 h-5" />
            <span className="hidden sm:inline">Anunciar Item</span>
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* BARRA DE BUSCA */}
        <div className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nome ou descrição..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-10 pr-10 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchText && (
              <button onClick={() => setSearchText("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFiltros(!showFiltros)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition ${
              showFiltros || temFiltroAtivo
                ? "bg-blue-700 text-white border-blue-700"
                : "bg-white text-gray-700 border-gray-200 hover:border-blue-400"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filtros
            {temFiltroAtivo && (
              <span className="bg-white text-blue-700 text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">!</span>
            )}
          </button>
        </div>

        {/* PAINEL DE FILTROS */}
        {showFiltros && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Categoria</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="todas">Todas as categorias</option>
                {categorias.map((cat) => (
                  <option key={cat.idcategoria} value={String(cat.idcategoria)}>
                    {cat.nome_categoria}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Período e faixa de preço</label>
              <div className="flex gap-2 mb-3">
                {(["diario", "semanal", "mensal"] as Periodo[]).map((p) => (
                  <button key={p} onClick={() => setPeriodo(p)}
                    className={`px-4 py-2 rounded-lg text-xs font-medium border transition ${
                      periodo === p ? "bg-blue-700 text-white border-blue-700" : "bg-white text-gray-600 border-gray-200 hover:border-blue-400"
                    }`}>
                    {p === "diario" ? "Por dia" : p === "semanal" ? "Por semana" : "Por mês"}
                  </button>
                ))}
              </div>
              <div className="flex gap-3 items-center">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-gray-400 text-xs">R$</span>
                  <input type="number" placeholder="Mín" value={precoMin} onChange={(e) => setPrecoMin(e.target.value)} min={0}
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <span className="text-gray-400">—</span>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-gray-400 text-xs">R$</span>
                  <input type="number" placeholder="Máx" value={precoMax} onChange={(e) => setPrecoMax(e.target.value)} min={0}
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Data do anúncio</label>
              <div className="flex gap-3 items-center">
                <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="text-gray-400 text-sm">até</span>
                <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Ordenar por</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "recente", label: "Mais recentes" },
                  { value: "preco_asc", label: "Menor preço" },
                  { value: "preco_desc", label: "Maior preço" },
                  { value: "az", label: "A-Z" },
                ].map((op) => (
                  <button key={op.value} onClick={() => setOrdenacao(op.value as Ordenacao)}
                    className={`px-4 py-2 rounded-lg text-xs font-medium border transition ${
                      ordenacao === op.value ? "bg-blue-700 text-white border-blue-700" : "bg-white text-gray-600 border-gray-200 hover:border-blue-400"
                    }`}>
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            {/* LOCALIZAÇÃO */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Localização
              </label>
              {!proximoRaio ? (
                <button
                  type="button"
                  onClick={() => ativarProximidade(5)}
                  disabled={locLoading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 hover:border-blue-400 hover:text-blue-600 transition w-full justify-center disabled:opacity-60"
                >
                  {locLoading
                    ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    : <LocateFixed className="w-4 h-4 text-blue-500" />
                  }
                  {locLoading ? "Obtendo localização..." : "Anúncios próximos a mim"}
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-xl border border-blue-100">
                    {locLoading
                      ? <Loader2 className="w-4 h-4 animate-spin text-blue-500 flex-shrink-0" />
                      : <LocateFixed className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    }
                    <span className="text-sm text-blue-700 font-medium flex-1">
                      {locLoading
                        ? "Obtendo localização..."
                        : userLat != null
                        ? "Localização ativa"
                        : "Aguardando permissão..."}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setProximoRaio(null); clearLocation(); }}
                      className="text-blue-400 hover:text-red-500 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {locError && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      {locError}
                    </p>
                  )}

                  {userLat != null && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1.5">Raio de busca:</p>
                      <div className="flex gap-2">
                        {RAIOS_KM.map(km => (
                          <button
                            key={km}
                            type="button"
                            onClick={() => setProximoRaio(km)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition ${
                              proximoRaio === km
                                ? "bg-blue-700 text-white border-blue-700"
                                : "bg-white text-gray-600 border-gray-200 hover:border-blue-400"
                            }`}
                          >
                            {km} km
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {temFiltroAtivo && (
              <button onClick={limparFiltros} className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 font-medium">
                <X className="w-4 h-4" /> Limpar todos os filtros
              </button>
            )}
          </div>
        )}

        {/* CHIPS DE FILTROS ATIVOS */}
        {temFiltroAtivo && (
          <div className="flex flex-wrap gap-2 mb-4">
            {categoryFilter !== "todas" && (
              <span className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                {categorias.find(c => String(c.idcategoria) === categoryFilter)?.nome_categoria || "Categoria"}
                <button onClick={() => setCategoryFilter("todas")}><X className="w-3 h-3" /></button>
              </span>
            )}
            {searchText && (
              <span className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                Busca: "{searchText}"
                <button onClick={() => setSearchText("")}><X className="w-3 h-3" /></button>
              </span>
            )}
            {precoMin && (
              <span className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                Mín: R$ {precoMin}
                <button onClick={() => setPrecoMin("")}><X className="w-3 h-3" /></button>
              </span>
            )}
            {precoMax && (
              <span className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                Máx: R$ {precoMax}
                <button onClick={() => setPrecoMax("")}><X className="w-3 h-3" /></button>
              </span>
            )}
            {dataInicio && (
              <span className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                De: {dataInicio}
                <button onClick={() => setDataInicio("")}><X className="w-3 h-3" /></button>
              </span>
            )}
            {dataFim && (
              <span className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                Até: {dataFim}
                <button onClick={() => setDataFim("")}><X className="w-3 h-3" /></button>
              </span>
            )}
            {periodo !== "diario" && (
              <span className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                {periodo === "semanal" ? "Por semana" : "Por mês"}
                <button onClick={() => setPeriodo("diario")}><X className="w-3 h-3" /></button>
              </span>
            )}
            {ordenacao !== "recente" && (
              <span className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                {ordenacao === "preco_asc" ? "Menor preço" : ordenacao === "preco_desc" ? "Maior preço" : "A-Z"}
                <button onClick={() => setOrdenacao("recente")}><X className="w-3 h-3" /></button>
              </span>
            )}
            {proximoRaio && (
              <span className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                <MapPin className="w-3 h-3" />
                Até {proximoRaio} km
                <button onClick={() => { setProximoRaio(null); clearLocation(); }}><X className="w-3 h-3" /></button>
              </span>
            )}
          </div>
        )}

        {/* AVISO: filtro de proximidade ativo mas sem localização */}
        {proximoRaio && userLat == null && !locLoading && locError && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 flex items-center gap-3">
            <MapPin className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-yellow-700 font-medium">Localização indisponível</p>
              <p className="text-xs text-yellow-600 truncate">{locError}</p>
            </div>
            <button
              type="button"
              onClick={requestLocation}
              className="text-xs text-yellow-700 font-semibold underline flex-shrink-0"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* AVISO: itens ocultados por não terem localização cadastrada */}
        {proximityActive && itensSemCoordenadas > 0 && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 flex items-center gap-3">
            <MapPin className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <p className="text-xs text-blue-600 flex-1">
              {itensSemCoordenadas} anúncio(s) sem localização cadastrada não aparecem no filtro de proximidade.
              Anúncios criados antes da atualização precisam ser reeditados e salvos para registrar a localização.
            </p>
          </div>
        )}

        {/* ITENS */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            {loading ? "Buscando..." : `Itens Disponíveis`}
          </h2>
          {temFiltroAtivo && (
            <button
              onClick={limparFiltros}
              className="flex items-center gap-1.5 text-sm font-semibold text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition"
            >
              <X className="w-3.5 h-3.5" />
              Limpar filtros
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-80 bg-gray-200 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : displayedItems.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
            <Package className="w-14 h-14 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Nenhum item encontrado</h3>
            <p className="text-gray-400 text-sm mb-4">
              {proximoRaio && userLat != null
                ? `Sem anúncios em até ${proximoRaio} km da sua localização`
                : "Tente ajustar os filtros"}
            </p>
            {temFiltroAtivo && (
              <button onClick={limparFiltros} className="text-blue-600 hover:underline text-sm font-medium">
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {displayedItems.map((item) => {
              const preco = item[CAMPO_PRECO[periodo]] as number;
              const distancia = userLat != null && userLon != null && item.latitude != null && item.longitude != null
                ? haversineKm(userLat, userLon, item.latitude, item.longitude)
                : null;
              return (
                <div key={item.iditem} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition">
                  <div className="aspect-[16/10] sm:aspect-square w-full overflow-hidden bg-gray-100 relative">
                    {item.foto_url ? (
                      <img
                        src={item.foto_url}
                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                        alt={item.nome}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Package className="w-12 h-12 text-gray-300" />
                      </div>
                    )}
                    {item.nome_categoria && (
                      <span className="absolute top-2 left-2 bg-white/90 text-blue-600 text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm">
                        {item.nome_categoria}
                      </span>
                    )}
                    {distancia != null && (
                      <span className="absolute top-2 right-2 bg-white/90 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-0.5">
                        <MapPin className="w-3 h-3 text-blue-500" />
                        {distancia < 1 ? `${Math.round(distancia * 1000)} m` : `${distancia.toFixed(1)} km`}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-gray-900 text-sm truncate">{item.nome}</h3>
                    <p className="text-green-600 font-semibold text-sm mt-0.5">
                      R$ {Number(preco).toFixed(2)}/{LABEL_PRECO[periodo]}
                    </p>

                    {item.locador_nome && (
                      <p className="mt-1 text-xs text-gray-400 truncate">{item.locador_nome}</p>
                    )}

                    <button
                      onClick={() => {
                        sessionStorage.setItem("h_scrollY", String(window.scrollY));
                        sessionStorage.setItem("h_scrollY_pending", "1");
                        onOpenItem(item.iditem);
                      }}
                      className="mt-3 w-full bg-blue-700 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-800 transition"
                    >
                      Ver Detalhes
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
