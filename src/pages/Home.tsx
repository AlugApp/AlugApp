import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  Wrench, Laptop, Dumbbell, Package,
  Search, SlidersHorizontal, X,
  Home as HomeIcon, MessageSquare, User, PlusCircle, CirclePlus,
} from "lucide-react";


interface HomeProps {
  onGoToAnnounce: () => void;
  onGoToPerfil: () => void;
  onOpenItem: (id: number) => void;
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

const categories = [
  { id: "1", label: "Ferramentas", icon: Wrench },
  { id: "2", label: "Esportes", icon: Dumbbell },
  { id: "3", label: "Eletrônicos", icon: Laptop },
  { id: "4", label: "Outros", icon: Package },
];

export default function Home({ onGoToAnnounce, onGoToPerfil, onOpenItem }: HomeProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const [categoryFilter, setCategoryFilter] = useState("todas");
  const [searchText, setSearchText] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>("diario");
  const [precoMin, setPrecoMin] = useState("");
  const [precoMax, setPrecoMax] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("recente");
  const [showFiltros, setShowFiltros] = useState(false);

  const campoPrecoDB: Record<Periodo, string> = {
    diario: "valor_aluguel_diario",
    semanal: "valor_aluguel_semana",
    mensal: "valor_aluguel_mensal",
  };

  const loadItems = async () => {
    setLoading(true);

    let query = supabase.from("item").select("*, categoria(nome_categoria)");

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

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, searchText, periodo, precoMin, precoMax, dataInicio, dataFim, ordenacao]);

  const temFiltroAtivo = !!(searchText || precoMin || precoMax || dataInicio || dataFim || categoryFilter !== "todas");

  const limparFiltros = () => {
    setSearchText(""); setPrecoMin(""); setPrecoMax("");
    setDataInicio(""); setDataFim("");
    setCategoryFilter("todas"); setOrdenacao("recente"); setPeriodo("diario");
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">

      {/* HEADER */}
      <header className="bg-white px-0 py-0 flex justify-between items-center shadow-sm">
        <div className="flex items-center">
          <img src="/AlugApp-Azul.png" alt="AlugApp" className="w-20 h-20" />
          <span className="text-2xl font-bold text-blue-600 -ml-0">AlugApp</span>
        </div>
        <button
          onClick={onGoToAnnounce}
          className="flex items-center gap-2 bg-blue-700 text-white px-5 py-2.5 rounded-full font-semibold text-sm hover:bg-blue-800 transition"
        >
          <CirclePlus className="w-5 h-5" />
          Anunciar Item
        </button>
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

            {temFiltroAtivo && (
              <button onClick={limparFiltros} className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 font-medium">
                <X className="w-4 h-4" /> Limpar todos os filtros
              </button>
            )}
          </div>
        )}

        {/* CATEGORIAS */}
        <h2 className="text-lg font-bold text-gray-900 mb-4">Categorias</h2>
        <div className="grid grid-cols-4 gap-4 mb-8">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const active = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(active ? "todas" : cat.id)}
                className={`bg-white rounded-2xl py-5 border flex flex-col items-center gap-2 transition hover:shadow-md ${
                  active ? "border-blue-600 shadow-md" : "border-gray-200"
                }`}
              >
                <Icon className={`w-7 h-7 ${active ? "text-blue-600" : "text-blue-500"}`} strokeWidth={1.5} />
                <span className={`text-xs font-medium ${active ? "text-blue-600" : "text-gray-600"}`}>
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* ITENS */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            {loading ? "Buscando..." : `Itens Disponíveis`}
          </h2>
          {temFiltroAtivo && (
            <button onClick={limparFiltros} className="text-sm text-blue-600 hover:underline">
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
        ) : items.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
            <Package className="w-14 h-14 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Nenhum item encontrado</h3>
            <p className="text-gray-400 text-sm mb-4">Tente ajustar os filtros</p>
            {temFiltroAtivo && (
              <button onClick={limparFiltros} className="text-blue-600 hover:underline text-sm font-medium">
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {items.map((item) => {
              const preco = item[CAMPO_PRECO[periodo]] as number;
              return (
                <div key={item.iditem} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition">
                  <img
                    src={item.foto_url || "https://via.placeholder.com/300x200?text=Sem+Imagem"}
                    className="w-full h-52 object-cover"
                    alt={item.nome}
                  />
                  <div className="p-4">
                    <h3 className="font-bold text-gray-900 text-sm truncate">{item.nome}</h3>
                    <p className="text-green-600 font-semibold text-sm mt-0.5">
                      R$ {Number(preco).toFixed(2)}/{LABEL_PRECO[periodo]}
                    </p>

                    {(item.locador_nome || item.nome_categoria) && (
                      <div className="mt-1.5 text-xs text-gray-400 leading-snug">
                        {item.locador_nome && <p>{item.locador_nome}</p>}
                        {item.locador_apto && item.locador_bloco && (
                          <p>Apto {item.locador_apto} - Bloco {item.locador_bloco}</p>
                        )}
                        {!item.locador_nome && item.nome_categoria && (
                          <p>{item.nome_categoria}</p>
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => onOpenItem(item.iditem)}
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

      {/* BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-16 flex justify-around items-center px-4">
        <button className="flex flex-col items-center gap-0.5 text-blue-600">
          <HomeIcon className="w-6 h-6" />
          <span className="text-xs font-medium">Início</span>
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
        <button
          onClick={onGoToPerfil}
          className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600 transition"
        >
          <User className="w-6 h-6" />
          <span className="text-xs">Perfil</span>
        </button>
      </nav>
    </div>
  );
}
