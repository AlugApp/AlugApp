import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { ArrowLeft, Star, MessageSquare, Package, ShoppingBag, ChevronLeft, ChevronRight, CheckCircle, XCircle } from "lucide-react";

interface DetalhesProps {
  id: number;
  onGoBack: () => void;
}

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DIAS_SEMANA = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

const REGRAS = [
  { titulo: "Condições de devolução", texto: "O item deve ser devolvido nas mesmas condições em que foi entregue." },
  { titulo: "Verificação", texto: "O responsável pelo item deve verificar seu estado no momento da devolução." },
  { titulo: "Responsabilidade por danos", texto: "Em caso de danos, o locatário deve arcar com os custos de reparo ou reposição." },
  { titulo: "Disponibilidade", texto: "O responsável pelo item deve estar disponível para a entrega e retirada nos horários combinados." },
  { titulo: "Pagamento", texto: "O pagamento poderá ser processado pelo aplicativo ou diretamente ao responsável pelo item." },
];

function parseSentinels(datas: string[]) {
  return datas
    .filter(d => d.startsWith("REC:"))
    .map(d => Number(d.split(":")[1]));
}

function CalendarioLeitura({ datasIndisponiveis }: { datasIndisponiveis: string[] }) {
  const hoje = new Date();
  const [mesAtual, setMesAtual] = useState(hoje.getMonth());
  const [anoAtual, setAnoAtual] = useState(hoje.getFullYear());

  const recorrentes = parseSentinels(datasIndisponiveis);
  const primeiroDia = new Date(anoAtual, mesAtual, 1).getDay();
  const totalDias = new Date(anoAtual, mesAtual + 1, 0).getDate();
  const toKey = (d: number) =>
    `${anoAtual}-${String(mesAtual + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}-${String(hoje.getDate()).padStart(2,"0")}`;

  const cells: (number | null)[] = [
    ...Array(primeiroDia).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ];

  const prevMes = () => {
    if (mesAtual === 0) { setMesAtual(11); setAnoAtual((a) => a - 1); }
    else setMesAtual((m) => m - 1);
  };
  const nextMes = () => {
    if (mesAtual === 11) { setMesAtual(0); setAnoAtual((a) => a + 1); }
    else setMesAtual((m) => m + 1);
  };

  return (
    <div className="max-w-xs">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMes} className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center">
          <ChevronLeft className="w-3 h-3 text-gray-500" />
        </button>
        <span className="text-xs font-semibold text-gray-700">{MESES[mesAtual]} {anoAtual}</span>
        <button type="button" onClick={nextMes} className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center">
          <ChevronRight className="w-3 h-3 text-gray-500" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-0.5">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="text-center text-[9px] font-semibold text-gray-400">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((dia, i) => {
          if (!dia) return <div key={i} />;
          const key = toKey(dia);
          const passado = key < hojeStr;
          const diaSemana = new Date(anoAtual, mesAtual, dia).getDay();
          const indisponivel = datasIndisponiveis.includes(key) || recorrentes.includes(diaSemana);
          return (
            <div
              key={i}
              className={`h-6 rounded text-[10px] font-medium flex items-center justify-center
                ${passado ? "text-gray-300" :
                  indisponivel ? "bg-red-100 text-red-500 border border-red-200" :
                  "bg-green-50 text-green-700 border border-green-100"}`}
            >
              {dia}
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 mt-2 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-50 border border-green-200 inline-block" /> Disponível</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-100 border border-red-200 inline-block" /> Indisponível</span>
      </div>
      {recorrentes.length > 0 && (
        <p className="text-[10px] text-gray-400 mt-1">
          {recorrentes.includes(0) && recorrentes.includes(6)
            ? "Finais de semana sempre indisponíveis."
            : recorrentes.includes(6)
            ? "Sábados sempre indisponíveis."
            : "Domingos sempre indisponíveis."}
        </p>
      )}
    </div>
  );
}

export default function DetalhesItem({ id, onGoBack }: DetalhesProps) {
  const { profile: myProfile, user } = useAuth();
  const [item, setItem] = useState<any>(null);
  const [fotos, setFotos] = useState<string[]>([]);
  const [fotoIndex, setFotoIndex] = useState(0);
  const [owner, setOwner] = useState<any>(null);
  const [ownerRating, setOwnerRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"info" | "indisponibilidade" | "regras">("info");
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

  const datasIndisponiveis: string[] = Array.isArray(item?.datas_indisponiveis) ? item.datas_indisponiveis : [];
  const adicionais: string[] = Array.isArray(item?.adicionais) ? item.adicionais : [];
  const recorrentes = parseSentinels(datasIndisponiveis);

  const rangeContemIndisponivel = (inicio: string, fim: string) => {
    if (!inicio || !fim) return false;
    const start = new Date(inicio + "T12:00:00");
    const end = new Date(fim + "T12:00:00");
    for (const ds of datasIndisponiveis) {
      if (ds.startsWith("REC:")) continue;
      const d = new Date(ds + "T12:00:00");
      if (d >= start && d <= end) return true;
    }
    if (recorrentes.length > 0) {
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (recorrentes.includes(d.getDay())) return true;
      }
    }
    return false;
  };

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
    if (rangeContemIndisponivel(aluguel.inicio, aluguel.fim)) {
      setSendMsg({ type: "error", text: "O período selecionado contém datas indisponíveis." });
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
      console.error("Erro no insert da solicitação:", error);
      setSendMsg({ type: "error", text: `Erro ao enviar solicitação: ${error.message}` });
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
  const diario = Number(item.valor_aluguel_diario);

  const TABS = [
    { key: "info", label: "Visão Geral" },
    { key: "indisponibilidade", label: "Indisponibilidade" },
    { key: "regras", label: "Regras" },
  ] as const;

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden pb-32">

      {/* HEADER */}
      <header className="bg-white px-0 py-0 flex items-center shadow-sm flex-shrink-0">
        <img src="/AlugApp-Azul.png" alt="AlugApp" className="w-16 h-16" />
        <span className="text-xl font-bold text-blue-600 -ml-0">AlugApp</span>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* IMAGEM */}
        <div className="relative w-5/12 flex-shrink-0 bg-white">
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

        {/* PAINEL DIREITO */}
        <div className="flex-1 bg-white flex flex-col overflow-hidden">

          {/* ABAS */}
          <div className="flex border-b border-gray-100 flex-shrink-0">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 py-3 text-sm font-semibold transition border-b-2 ${
                  tab === key
                    ? "text-blue-600 border-blue-600"
                    : "text-gray-400 border-transparent hover:text-gray-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* CONTEÚDO DA ABA */}
          <div className="flex-1 overflow-hidden px-6 py-4">

            {/* ABA: VISÃO GERAL */}
            {tab === "info" && (
              <div className="h-full flex flex-col gap-3">
                {/* Badges: categoria + estado */}
                <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                  {item.categoria?.nome_categoria && (
                    <span className="bg-blue-50 text-blue-600 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                      {item.categoria.nome_categoria}
                    </span>
                  )}
                  {item.estado && (
                    <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                      {item.estado}
                    </span>
                  )}
                </div>

                {/* Título + Avaliação */}
                <div className="flex-shrink-0">
                  <h1 className="text-xl font-bold text-gray-900 leading-tight">{item.nome}</h1>
                  <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="text-gray-800 font-semibold">
                      {ownerRating !== null ? ownerRating : "Sem avaliações"}
                    </span>
                  </div>
                </div>

                {/* Preços */}
                {(() => {
                  const semanal = item.valor_aluguel_semana ? Number(item.valor_aluguel_semana) : null;
                  const mensal  = item.valor_aluguel_mensal ? Number(item.valor_aluguel_mensal) : null;
                  const semanalBase = diario * 7;
                  const mensalBase  = diario * 30;
                  const pctSem = semanal && semanalBase > 0 ? Math.round((1 - semanal / semanalBase) * 100) : 0;
                  const pctMen = mensal  && mensalBase  > 0 ? Math.round((1 - mensal  / mensalBase)  * 100) : 0;
                  return (
                    <div className="grid grid-cols-3 gap-2 flex-shrink-0">
                      {/* Diária */}
                      <div className="border border-gray-200 rounded-xl p-2.5 text-center">
                        <p className="text-xs text-gray-400 mb-0.5">Diária</p>
                        <p className="font-bold text-green-600 text-sm">R$ {diario.toFixed(2)}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">valor base</p>
                      </div>

                      {/* Semanal */}
                      {semanal !== null && (
                        <div className={`rounded-xl p-2.5 text-center relative ${pctSem > 0 ? "bg-blue-50 border border-blue-100" : "border border-gray-200"}`}>
                          {pctSem > 0 && (
                            <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                              -{pctSem}% desc.
                            </span>
                          )}
                          <p className={`text-xs mb-0.5 ${pctSem > 0 ? "text-blue-500" : "text-gray-400"}`}>Semanal</p>
                          {pctSem > 0 && (
                            <p className="text-[10px] text-gray-300 line-through leading-none">R$ {semanalBase.toFixed(2)}</p>
                          )}
                          <p className={`font-bold text-sm ${pctSem > 0 ? "text-blue-700" : "text-green-600"}`}>R$ {semanal.toFixed(2)}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">7 dias</p>
                        </div>
                      )}

                      {/* Mensal */}
                      {mensal !== null && (
                        <div className={`rounded-xl p-2.5 text-center relative ${pctMen > 0 ? "bg-green-50 border border-green-100" : "border border-gray-200"}`}>
                          {pctMen > 0 && (
                            <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-green-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                              -{pctMen}% desc.
                            </span>
                          )}
                          <p className={`text-xs mb-0.5 ${pctMen > 0 ? "text-green-600" : "text-gray-400"}`}>Mensal</p>
                          {pctMen > 0 && (
                            <p className="text-[10px] text-gray-300 line-through leading-none">R$ {mensalBase.toFixed(2)}</p>
                          )}
                          <p className={`font-bold text-sm ${pctMen > 0 ? "text-green-700" : "text-green-600"}`}>R$ {mensal.toFixed(2)}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">30 dias</p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Proprietário */}
                <div className="flex items-center justify-between border rounded-xl p-3 flex-shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{owner?.fullName || "—"}</p>
                      <p className="text-xs text-gray-500">Proprietário</p>
                    </div>
                  </div>
                  <button className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-white" />
                  </button>
                </div>

                {/* Descrição */}
                {item.descricao && (() => {
                  const match = item.descricao.match(/^\[(.+?)\]\s*([\s\S]*)/);
                  const subtipo = match?.[1];
                  const texto = match ? match[2] : item.descricao;
                  return (
                    <div className="flex-shrink-0">
                      <h3 className="font-bold text-gray-900 text-sm mb-1">Descrição</h3>
                      {subtipo && (
                        <span className="inline-block bg-blue-50 text-blue-600 text-xs font-semibold px-2 py-0.5 rounded-full mb-1">{subtipo}</span>
                      )}
                      {texto && <p className="text-gray-500 text-xs leading-relaxed line-clamp-3">{texto}</p>}
                    </div>
                  );
                })()}

                {/* Adicionais */}
                {adicionais.length > 0 && (
                  <div className="flex-shrink-0">
                    <h3 className="font-bold text-gray-900 text-sm mb-1.5">Adicionais</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {adicionais.map((a) => (
                        <span key={a} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
                          <CheckCircle className="w-3 h-3" />
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ABA: INDISPONIBILIDADE */}
            {tab === "indisponibilidade" && (
              <div className="h-full flex flex-col gap-3">
                <p className="text-xs text-gray-400 flex-shrink-0">
                  Dias marcados em vermelho não estão disponíveis para aluguel.
                </p>
                <CalendarioLeitura datasIndisponiveis={datasIndisponiveis} />
              </div>
            )}

            {/* ABA: REGRAS */}
            {tab === "regras" && (
              <div className="h-full overflow-y-auto">
                <ul className="space-y-4">
                  {REGRAS.map((r) => (
                    <li key={r.titulo} className="flex gap-3">
                      <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{r.titulo}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{r.texto}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BARRA INFERIOR */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between z-40 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <div>
          <p className="text-xs text-gray-500">Valor por diária</p>
          <p className="text-xl font-bold text-green-600">R$ {diario.toFixed(2)}</p>
        </div>
        {user?.id === item.idlocador ? (
          <span className="text-sm text-gray-400 italic">Você é o proprietário</span>
        ) : item.disponivel === false ? (
          <span className="text-sm text-red-500 font-semibold flex items-center gap-1.5">
            <XCircle className="w-5 h-5" /> Item indisponível
          </span>
        ) : (
          <button
            onClick={() => { setShowAluguel(true); setSendMsg(null); }}
            className="flex items-center gap-2 bg-blue-600 text-white font-semibold px-8 py-2.5 rounded-xl hover:bg-blue-700 transition shadow-sm"
          >
            <ShoppingBag className="w-5 h-5" />
            Alugar
          </button>
        )}
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

            {aluguel.inicio && aluguel.fim && rangeContemIndisponivel(aluguel.inicio, aluguel.fim) && (
              <p className="text-xs text-red-500 font-medium">O período selecionado contém datas indisponíveis. Confira o calendário.</p>
            )}

            {calc && !rangeContemIndisponivel(aluguel.inicio, aluguel.fim) && (
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
