import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { ArrowLeft, Star, MessageSquare, Clock, Info, Package, ShoppingBag } from "lucide-react";


interface DetalhesProps {
  id: number;
  onGoBack: () => void;
}

export default function DetalhesItem({ id, onGoBack }: DetalhesProps) {
  const [item, setItem] = useState<any>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAluguel, setShowAluguel] = useState(false);
  const [aluguel, setAluguel] = useState({ inicio: "", fim: "", observacoes: "" });

  const loadItem = async () => {
    setLoading(true);

    const { data: itemResult } = await supabase
      .from("item")
      .select("*, categoria(nome_categoria)")
      .eq("iditem", id)
      .single();

    const { data: fotoResult } = await supabase
      .from("fotoitem")
      .select("*")
      .eq("iditem", id)
      .order("ordem_exibicao")
      .maybeSingle();

    setItem(itemResult);
    setFoto(fotoResult?.url_foto ?? null);
    setLoading(false);
  };

  useEffect(() => {
    loadItem();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 animate-pulse flex flex-col">
        <div className="h-16 bg-white border-b flex-shrink-0" />
        <div className="flex flex-1">
          <div className="w-5/12 bg-gray-300" />
          <div className="flex-1 p-8 space-y-4">
            <div className="h-7 bg-gray-200 rounded w-2/3" />
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-5 bg-gray-200 rounded w-1/4" />
          </div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Package className="w-20 h-20 text-gray-400 mb-3" />
        <p className="text-xl font-semibold text-gray-700">Item não encontrado</p>
        <button
          onClick={onGoBack}
          className="mt-4 px-6 py-2 rounded-xl bg-blue-600 text-white font-semibold"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* HEADER */}
      <header className="bg-white px-0 py-0 flex items-center shadow-sm flex-shrink-0">
        <img src="/AlugApp-Azul.png" alt="AlugApp" className="w-20 h-20" />
        <span className="text-2xl font-bold text-blue-600 -ml-0">AlugApp</span>
      </header>

      {/* MAIN — dois painéis */}
      <div className="flex flex-1 overflow-hidden">

        {/* IMAGEM — esquerda */}
        <div className="relative w-5/12 flex-shrink-0 bg-gray-200 min-h-[calc(100vh-4rem)]">
          <button
            onClick={onGoBack}
            className="absolute top-4 left-4 z-10 w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>

          {foto ? (
            <img src={foto} className="w-full h-full object-cover" alt={item.nome} />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-24 h-24 text-gray-400" />
            </div>
          )}
        </div>

        {/* DETALHES — direita */}
        <div className="flex-1 bg-white overflow-y-auto pb-28 px-8 py-6 space-y-5">

          {/* Título */}
          <h1 className="text-2xl font-bold text-gray-900">{item.nome}</h1>

          {/* Avaliação + Localização */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="text-gray-800 font-semibold">4.8</span>
            <span>•</span>
            <span>{item.localizacao || "Não informado"}</span>
          </div>

          {/* Preço */}
          <p className="text-green-600 font-bold text-xl">
            R$ {item.valor_aluguel_diario}/diária
          </p>

          {/* Card do Proprietário */}
          <div className="flex items-center justify-between border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  {item.proprietario_nome || "Proprietário"}
                </p>
                <p className="text-sm text-gray-500">Proprietário</p>
              </div>
            </div>
            <button className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Descrição */}
          <div>
            <h3 className="font-bold text-gray-900 mb-2">Descrição</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              {item.descricao || "Sem descrição."}
            </p>
          </div>

          {/* Detalhes */}
          <div>
            <h3 className="font-bold text-gray-900 mb-3">Detalhes</h3>
            <div className="grid grid-cols-2 gap-3 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span>Disponível Imediatamente</span>
              </div>
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 flex-shrink-0" />
                <span>Excelente Estado</span>
              </div>
            </div>
          </div>

          {/* Regras de Uso */}
          <div>
            <h3 className="font-bold text-gray-900 mb-2">Regras de Uso</h3>
            <ul className="space-y-1 text-sm text-gray-500">
              {[
                "Limpeza após o uso",
                "Reportar qualquer problema",
              ].map((regra) => (
                <li key={regra} className="flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  <span>{regra}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* BARRA INFERIOR FIXA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-8 py-4 flex items-center justify-between z-20">
        <div>
          <p className="text-xs text-gray-500">Valor por diária</p>
          <p className="text-2xl font-bold text-green-600">R$ {item.valor_aluguel_diario}</p>
        </div>
        <button
          onClick={() => setShowAluguel(true)}
          className="flex items-center gap-2 bg-blue-600 text-white font-semibold px-8 py-3 rounded-xl hover:bg-blue-700 transition"
        >
          <ShoppingBag className="w-5 h-5" />
          Alugar
        </button>
      </div>

      {/* MODAL ALUGUEL */}
      {showAluguel && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Solicitar Aluguel</h2>

            <div>
              <label className="text-sm text-gray-600 mb-1 block">Data de início</label>
              <input
                type="date"
                className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={aluguel.inicio}
                onChange={(e) => setAluguel({ ...aluguel, inicio: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm text-gray-600 mb-1 block">Data de devolução</label>
              <input
                type="date"
                className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={aluguel.fim}
                onChange={(e) => setAluguel({ ...aluguel, fim: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm text-gray-600 mb-1 block">Observações</label>
              <textarea
                placeholder="Alguma observação..."
                className="w-full border rounded-lg p-2 min-h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={aluguel.observacoes}
                onChange={(e) => setAluguel({ ...aluguel, observacoes: e.target.value })}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                className="flex-1 border rounded-xl py-2 text-gray-700 font-medium"
                onClick={() => setShowAluguel(false)}
              >
                Cancelar
              </button>
              <button className="flex-1 bg-blue-600 text-white rounded-xl py-2 font-semibold hover:bg-blue-700 transition">
                Enviar Solicitação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
