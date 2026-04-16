import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { ArrowLeft, Star, MessageSquare, Package, ShoppingBag, Clock, Info, ChevronLeft, ChevronRight } from "lucide-react";

interface DetalhesProps {
  id: number;
  onGoBack: () => void;
}

export default function DetalhesItem({ id, onGoBack }: DetalhesProps) {
  const { profile: myProfile } = useAuth();
  const [item, setItem] = useState<any>(null);
  const [fotos, setFotos] = useState<string[]>([]);
  const [fotoIndex, setFotoIndex] = useState(0);
  const [owner, setOwner] = useState<any>(null);
  const [ownerRating, setOwnerRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAluguel, setShowAluguel] = useState(false);
  const [aluguel, setAluguel] = useState({ inicio: "", fim: "", observacoes: "" });
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { data: itemResult } = await supabase
        .from("item")
        .select("*, categoria(nome_categoria)")
        .eq("iditem", id)
        .single();

      const { data: fotosResult } = await supabase
        .from("fotoitem")
        .select("url_foto")
        .eq("iditem", id)
        .order("ordem_exibicao");

      setItem(itemResult);
      setFotos((fotosResult || []).map((f: any) => f.url_foto));
      setFotoIndex(0);

      if (itemResult?.idlocador) {
        const { data: ownerResult } = await supabase
          .from("users")
          .select("id, fullName")
          .eq("auth_id", itemResult.idlocador)
          .maybeSingle();

        setOwner(ownerResult);

        if (ownerResult?.id) {
          const { data: ratings } = await supabase
            .from("avaliacao")
            .select("nota")
            .eq("idavaliado", ownerResult.id);

          if (ratings && ratings.length > 0) {
            const avg = ratings.reduce((s: number, r: any) => s + r.nota, 0) / ratings.length;
            setOwnerRating(Math.round(avg * 10) / 10);
          }
        }
      }

      setLoading(false);
    };
    load();
  }, [id]);

  const calcularTotal = () => {
    if (!aluguel.inicio || !aluguel.fim || !item) return null;
    const dias = Math.ceil(
      (new Date(aluguel.fim).getTime() - new Date(aluguel.inicio).getTime()) / 86400000
    );
    if (dias <= 0) return null;
    return { dias, total: dias * Number(item.valor_aluguel_diario) };
  };

  const handleSolicitar = async () => {
    if (!aluguel.inicio || !aluguel.fim) {
      setSendMsg({ type: "error", text: "Preencha as datas." });
      return;
    }
    const calc = calcularTotal();
    if (!calc || calc.dias <= 0) {
      setSendMsg({ type: "error", text: "Data de devolução deve ser após a data de início." });
      return;
    }
    if (!myProfile?.id || !owner?.id) {
      setSendMsg({ type: "error", text: "Usuário não autenticado." });
      return;
    }

    setSending(true);
    setSendMsg(null);

    const { error } = await supabase.from("solicitacao_aluguel").insert([{
      iditem: item.iditem,
      idlocador: owner.id,
      idlocatario: myProfile.id,
      data_inicio_prevista: aluguel.inicio,
      data_fim_prevista: aluguel.fim,
      valor_total_previsto: calc.total,
      status: "pendente",
    }]);

    if (error) {
      setSendMsg({ type: "error", text: "Erro ao enviar solicitação. Tente novamente." });
    } else {
      setSendMsg({ type: "success", text: "Solicitação enviada com sucesso!" });
      setTimeout(() => { setShowAluguel(false); setSendMsg(null); setAluguel({ inicio: "", fim: "", observacoes: "" }); }, 1800);
    }
    setSending(false);
  };

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
        <button onClick={onGoBack} className="mt-4 px-6 py-2 rounded-xl bg-blue-600 text-white font-semibold">
          Voltar
        </button>
      </div>
    );
  }

  const calc = calcularTotal();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* HEADER */}
      <header className="bg-white px-0 py-0 flex items-center shadow-sm flex-shrink-0">
        <img src="/AlugApp-Azul.png" alt="AlugApp" className="w-20 h-20" />
        <span className="text-2xl font-bold text-blue-600 -ml-0">AlugApp</span>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* IMAGEM */}
        <div className="relative w-5/12 flex-shrink-0 bg-white h-[calc(100vh-5rem-5rem)]">
          <button
            onClick={onGoBack}
            className="absolute top-4 left-4 z-10 w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          {fotos.length > 0 ? (
            <img src={fotos[fotoIndex]} className="w-full h-full object-contain bg-white" alt={item.nome} />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-24 h-24 text-gray-400" />
            </div>
          )}
          {fotos.length > 1 && (
            <>
              <button
                onClick={() => setFotoIndex((i) => (i - 1 + fotos.length) % fotos.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition"
              >
                <ChevronLeft className="w-5 h-5 text-gray-700" />
              </button>
              <button
                onClick={() => setFotoIndex((i) => (i + 1) % fotos.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition"
              >
                <ChevronRight className="w-5 h-5 text-gray-700" />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {fotos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setFotoIndex(i)}
                    className={`w-2 h-2 rounded-full transition ${i === fotoIndex ? "bg-blue-600" : "bg-gray-300"}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* DETALHES */}
        <div className="flex-1 bg-white overflow-y-auto pb-28 px-8 py-6 space-y-5">

          {/* Categoria */}
          {item.categoria?.nome_categoria && (
            <span className="inline-block bg-blue-50 text-blue-600 text-xs font-semibold px-3 py-1 rounded-full">
              {item.categoria.nome_categoria}
            </span>
          )}

          <h1 className="text-2xl font-bold text-gray-900">{item.nome}</h1>

          {/* Avaliação do dono */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="text-gray-800 font-semibold">
              {ownerRating !== null ? ownerRating : "Sem avaliações"}
            </span>
          </div>

          {/* Preços */}
          <div className="grid grid-cols-3 gap-3">
            <div className="border rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">Diária</p>
              <p className="font-bold text-green-600">R$ {Number(item.valor_aluguel_diario).toFixed(2)}</p>
            </div>
            {item.valor_aluguel_semana && (
              <div className="border rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">Semanal</p>
                <p className="font-bold text-green-600">R$ {Number(item.valor_aluguel_semana).toFixed(2)}</p>
              </div>
            )}
            {item.valor_aluguel_mensal && (
              <div className="border rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">Mensal</p>
                <p className="font-bold text-green-600">R$ {Number(item.valor_aluguel_mensal).toFixed(2)}</p>
              </div>
            )}
          </div>

          {/* Card do Proprietário */}
          <div className="flex items-center justify-between border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{owner?.fullName || "—"}</p>
                <p className="text-sm text-gray-500">Proprietário</p>
              </div>
            </div>
            <button className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Descrição */}
          {item.descricao && (
            <div>
              <h3 className="font-bold text-gray-900 mb-2">Descrição</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{item.descricao}</p>
            </div>
          )}

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
              {["Devolução no mesmo dia até 22h", "Limpeza após o uso", "Reportar qualquer problema", "Respeitar regras do condomínio"].map((r) => (
                <li key={r} className="flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* BARRA INFERIOR */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-8 py-4 flex items-center justify-between z-20">
        <div>
          <p className="text-xs text-gray-500">Valor por diária</p>
          <p className="text-2xl font-bold text-green-600">R$ {Number(item.valor_aluguel_diario).toFixed(2)}</p>
        </div>
        <button
          onClick={() => { setShowAluguel(true); setSendMsg(null); }}
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

            {sendMsg && (
              <div className={`p-3 rounded-xl text-sm text-center font-medium ${
                sendMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
              }`}>
                {sendMsg.text}
              </div>
            )}

            <div>
              <label className="text-sm text-gray-600 mb-1 block">Data de início</label>
              <input
                type="date"
                className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={aluguel.inicio}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setAluguel({ ...aluguel, inicio: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm text-gray-600 mb-1 block">Data de devolução</label>
              <input
                type="date"
                className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={aluguel.fim}
                min={aluguel.inicio || new Date().toISOString().split("T")[0]}
                onChange={(e) => setAluguel({ ...aluguel, fim: e.target.value })}
              />
            </div>

            {calc && (
              <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700">
                <span className="font-semibold">{calc.dias} dia{calc.dias > 1 ? "s" : ""}</span> —{" "}
                Total: <span className="font-bold text-green-600">R$ {calc.total.toFixed(2)}</span>
              </div>
            )}

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
                onClick={() => { setShowAluguel(false); setSendMsg(null); }}
                disabled={sending}
              >
                Cancelar
              </button>
              <button
                className="flex-1 bg-blue-600 text-white rounded-xl py-2 font-semibold hover:bg-blue-700 transition disabled:opacity-60"
                onClick={handleSolicitar}
                disabled={sending}
              >
                {sending ? "Enviando..." : "Enviar Solicitação"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
