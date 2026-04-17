import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { ArrowLeft, Plus, X, ChevronLeft, ChevronRight } from "lucide-react";

interface Categoria {
  idcategoria: number;
  nome_categoria: string;
}

interface AnunciarItemProps {
  onGoBack: () => void;
}

const inputClass =
  "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50";

const ESTADOS_ITEM = ["Novo", "Seminovo", "Usado"];

const ADICIONAIS_OPCOES = [
  "Entrega incluída",
  "Retirada incluída",
  "Manual disponível",
  "Acessórios incluídos",
  "Instalação incluída",
  "Embalagem original",
];

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DIAS_SEMANA = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

function CalendarioDisponibilidade({
  datasIndisponiveis,
  onChange,
}: {
  datasIndisponiveis: string[];
  onChange: (datas: string[]) => void;
}) {
  const hoje = new Date();
  const [mesAtual, setMesAtual] = useState(hoje.getMonth());
  const [anoAtual, setAnoAtual] = useState(hoje.getFullYear());

  const primeiroDia = new Date(anoAtual, mesAtual, 1).getDay();
  const totalDias = new Date(anoAtual, mesAtual + 1, 0).getDate();

  const toKey = (d: number) =>
    `${anoAtual}-${String(mesAtual + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const toggleDia = (dia: number) => {
    const d = new Date(anoAtual, mesAtual, dia);
    if (d < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) return;
    const key = toKey(dia);
    onChange(
      datasIndisponiveis.includes(key)
        ? datasIndisponiveis.filter((x) => x !== key)
        : [...datasIndisponiveis, key]
    );
  };

  const prevMes = () => {
    if (mesAtual === 0) { setMesAtual(11); setAnoAtual((a) => a - 1); }
    else setMesAtual((m) => m - 1);
  };
  const nextMes = () => {
    if (mesAtual === 11) { setMesAtual(0); setAnoAtual((a) => a + 1); }
    else setMesAtual((m) => m + 1);
  };

  const cells: (number | null)[] = [
    ...Array(primeiroDia).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ];

  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}-${String(hoje.getDate()).padStart(2,"0")}`;

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
          const indisponivel = datasIndisponiveis.includes(key);
          return (
            <button
              type="button"
              key={i}
              onClick={() => toggleDia(dia)}
              disabled={passado}
              className={`h-6 rounded text-[10px] font-medium transition
                ${passado ? "text-gray-300 cursor-not-allowed" :
                  indisponivel ? "bg-red-100 text-red-600 border border-red-200" :
                  "hover:bg-blue-50 text-gray-700 border border-transparent"}`}
            >
              {dia}
            </button>
          );
        })}
      </div>
      <div className="flex gap-4 mt-2 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-100 border border-red-200 inline-block" /> Indisponível</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-white border border-gray-200 inline-block" /> Disponível</span>
      </div>
    </div>
  );
}

export default function AnunciarItem({ onGoBack }: AnunciarItemProps) {
  const { user } = useAuth();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [outraCategoria, setOutraCategoria] = useState("");
  const [fotos, setFotos] = useState<{ file: File; preview: string }[]>([]);
  const [datasIndisponiveis, setDatasIndisponiveis] = useState<string[]>([]);
  const [adicionaisSelecionados, setAdicionaisSelecionados] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    idcategoria: "",
    valor_aluguel_diario: "",
    estado: "",
  });

  useEffect(() => {
    supabase.from("categoria").select("*").then(({ data }) => {
      if (data) setCategorias(data);
    });
  }, []);

  const categoriaSelecionada = categorias.find((c) => String(c.idcategoria) === formData.idcategoria);
  const isOutros = categoriaSelecionada?.nome_categoria?.toLowerCase() === "outros";

  const diario = Number(formData.valor_aluguel_diario) || 0;
  const semanal = diario > 0 ? +(diario * 7 * 0.9).toFixed(2) : 0;
  const mensal  = diario > 0 ? +(diario * 30 * 0.8).toFixed(2) : 0;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const novas = files.map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setFotos((prev) => [...prev, ...novas]);
    e.target.value = "";
  };

  const removerFoto = (index: number) => setFotos((prev) => prev.filter((_, i) => i !== index));

  const toggleAdicional = (op: string) => {
    setAdicionaisSelecionados((prev) =>
      prev.includes(op) ? prev.filter((x) => x !== op) : [...prev, op]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.idcategoria || !formData.valor_aluguel_diario) {
      setMsg({ type: "error", text: "Preencha todos os campos obrigatórios." });
      return;
    }
    if (isOutros && !outraCategoria.trim()) {
      setMsg({ type: "error", text: "Descreva o tipo do item para a categoria Outros." });
      return;
    }

    setSubmitting(true);
    setMsg(null);

    const { data: itemCreated, error } = await supabase
      .from("item")
      .insert([{
        nome: formData.nome,
        descricao: isOutros && outraCategoria.trim()
          ? `[${outraCategoria.trim()}] ${formData.descricao}`.trim()
          : formData.descricao,
        idcategoria: Number(formData.idcategoria),
        valor_aluguel_diario: diario,
        valor_aluguel_semana: semanal,
        valor_aluguel_mensal: mensal,
        idlocador: user?.id,
        estado: formData.estado || null,
        adicionais: adicionaisSelecionados.length > 0 ? adicionaisSelecionados : null,
        datas_indisponiveis: datasIndisponiveis.length > 0 ? datasIndisponiveis : null,
      }])
      .select()
      .single();

    if (error) {
      setMsg({ type: "error", text: "Erro ao criar anúncio. Tente novamente." });
      setSubmitting(false);
      return;
    }

    if (fotos.length > 0) {
      setUploading(true);
      for (let i = 0; i < fotos.length; i++) {
        const fileName = `${itemCreated.iditem}-${Date.now()}-${i}`;
        const { error: uploadError } = await supabase.storage.from("items").upload(fileName, fotos[i].file);
        if (!uploadError) {
          const fotoUrl = `https://${process.env.REACT_APP_SUPABASE_URL!.replace("https://", "")}/storage/v1/object/public/items/${fileName}`;
          await supabase.from("fotoitem").insert([{ iditem: itemCreated.iditem, url_foto: fotoUrl, ordem_exibicao: i + 1 }]);
        }
      }
      setUploading(false);
    }

    setMsg({ type: "success", text: "Anúncio publicado com sucesso!" });
    setTimeout(() => onGoBack(), 1500);
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">

      {/* HEADER */}
      <header className="bg-white shadow-sm flex items-center gap-3 px-6 py-4 flex-shrink-0">
        <button onClick={onGoBack} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Criar Anúncio</h1>
      </header>

      <div className="flex-1 overflow-y-auto py-6 px-4">
        <div className="max-w-2xl mx-auto space-y-4">

          {msg && (
            <div className={`p-4 rounded-xl text-sm font-medium text-center ${msg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              {msg.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* FOTOS */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Fotos do item</p>
              <div className="flex gap-3 flex-wrap">
                {fotos.map((f, i) => (
                  <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0">
                    <img src={f.preview} className="w-full h-full object-cover" alt={`foto ${i + 1}`} />
                    <button type="button" onClick={() => removerFoto(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                      <X className="w-3 h-3 text-white" />
                    </button>
                    {i === 0 && <span className="absolute bottom-1 left-1 bg-blue-600 text-white text-[10px] font-bold px-1.5 rounded">Principal</span>}
                  </div>
                ))}
                <label className="cursor-pointer w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-1 hover:border-blue-400 hover:bg-blue-50 transition flex-shrink-0">
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                  <Plus className="w-6 h-6 text-gray-400" />
                  <span className="text-xs text-gray-400">Adicionar</span>
                </label>
              </div>
              {fotos.length === 0 && <p className="text-xs text-gray-400 mt-2">A primeira foto adicionada será a principal.</p>}
            </div>

            {/* INFORMAÇÕES */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              <h2 className="font-bold text-gray-900">Informações do item</h2>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Título *</label>
                <input
                  type="text" name="nome" value={formData.nome} onChange={handleChange}
                  placeholder="Ex: Furadeira elétrica 800W"
                  className={`${inputClass} mt-1`} required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Categoria *</label>
                <select
                  name="idcategoria" value={formData.idcategoria} onChange={handleChange}
                  className={`${inputClass} mt-1`} required
                >
                  <option value="">Selecione uma categoria</option>
                  {categorias.map((cat) => (
                    <option key={cat.idcategoria} value={cat.idcategoria}>{cat.nome_categoria}</option>
                  ))}
                </select>
                {isOutros && (
                  <div className="mt-3 relative">
                    <input
                      type="text"
                      value={outraCategoria}
                      onChange={(e) => setOutraCategoria(e.target.value)}
                      placeholder="Descreva o tipo do item (ex: Instrumentos musicais)"
                      className={`${inputClass} pr-4`}
                      required
                      maxLength={60}
                    />
                    <span className="absolute right-3 bottom-3 text-xs text-gray-300">
                      {outraCategoria.length}/60
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado do item</label>
                <select
                  name="estado" value={formData.estado} onChange={handleChange}
                  className={`${inputClass} mt-1`}
                >
                  <option value="">Selecione o estado</option>
                  {ESTADOS_ITEM.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Descrição</label>
                <textarea
                  name="descricao" value={formData.descricao} onChange={handleChange}
                  placeholder="Descreva o item, estado de conservação, acessórios inclusos..."
                  className={`${inputClass} mt-1 min-h-28 resize-none`}
                />
              </div>
            </div>

            {/* PREÇOS */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              <h2 className="font-bold text-gray-900">Preços</h2>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Valor por diária (R$) *</label>
                <input
                  type="number" name="valor_aluguel_diario" value={formData.valor_aluguel_diario}
                  onChange={handleChange} placeholder="0,00" min="0" step="0.01"
                  className={`${inputClass} mt-1`} required
                />
              </div>

              {diario > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-100 rounded-xl p-3 text-center">
                    <p className="text-xs text-blue-400 font-semibold mb-1">Semanal (10% desc.)</p>
                    <p className="text-lg font-bold text-blue-700">R$ {semanal.toFixed(2)}</p>
                    <p className="text-xs text-blue-400">= {diario.toFixed(2)} × 7 dias</p>
                  </div>
                  <div className="bg-green-100 rounded-xl p-3 text-center">
                    <p className="text-xs text-green-500 font-semibold mb-1">Mensal (20% desc.)</p>
                    <p className="text-lg font-bold text-green-700">R$ {mensal.toFixed(2)}</p>
                    <p className="text-xs text-green-500">= {diario.toFixed(2)} × 30 dias</p>
                  </div>
                </div>
              )}
            </div>

            {/* DISPONIBILIDADE */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-bold text-gray-900 mb-1">Disponibilidade</h2>
              <p className="text-xs text-gray-400 mb-4">Toque nas datas para marcá-las como indisponíveis (já reservadas ou bloqueadas).</p>
              <CalendarioDisponibilidade
                datasIndisponiveis={datasIndisponiveis}
                onChange={setDatasIndisponiveis}
              />
              {datasIndisponiveis.length > 0 && (
                <p className="text-xs text-red-500 mt-3">
                  {datasIndisponiveis.length} data{datasIndisponiveis.length > 1 ? "s" : ""} marcada{datasIndisponiveis.length > 1 ? "s" : ""} como indisponível{datasIndisponiveis.length > 1 ? "s" : ""}.
                </p>
              )}
            </div>

            {/* ADICIONAIS */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-bold text-gray-900 mb-1">Adicionais</h2>
              <p className="text-xs text-gray-400 mb-4">Selecione o que está incluso no aluguel.</p>
              <div className="grid grid-cols-2 gap-2">
                {ADICIONAIS_OPCOES.map((op) => {
                  const ativo = adicionaisSelecionados.includes(op);
                  return (
                    <button
                      type="button"
                      key={op}
                      onClick={() => toggleAdicional(op)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition
                        ${ativo
                          ? "bg-blue-50 border-blue-400 text-blue-700"
                          : "bg-gray-50 border-gray-200 text-gray-600 hover:border-blue-300"}`}
                    >
                      <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-white text-[10px]
                        ${ativo ? "bg-blue-600 border-blue-600" : "border-gray-300"}`}>
                        {ativo && "✓"}
                      </span>
                      {op}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* REGRAS DO ALUGUEL */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-bold text-gray-900 mb-3">Regras do aluguel</h2>
              <ul className="space-y-3">
                {[
                  { titulo: "Condições de devolução", texto: "O item deve ser devolvido nas mesmas condições em que foi entregue." },
                  { titulo: "Verificação", texto: "O responsável pelo item deve verificar seu estado no momento da devolução." },
                  { titulo: "Responsabilidade por danos", texto: "Em caso de danos, o locatário deve arcar com os custos de reparo ou reposição." },
                  { titulo: "Disponibilidade", texto: "O responsável pelo item deve estar disponível para a entrega e retirada nos horários combinados." },
                  { titulo: "Pagamento", texto: "O pagamento poderá ser processado pelo aplicativo ou diretamente ao responsável pelo item." },
                ].map((r) => (
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

            {/* BOTÕES */}
            <div className="flex gap-3 pb-8">
              <button
                type="button" onClick={onGoBack}
                className="flex-1 h-12 border border-gray-200 rounded-xl text-gray-700 font-semibold text-sm hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                type="submit" disabled={submitting || uploading}
                className="flex-1 h-12 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-60"
              >
                {submitting || uploading ? "Publicando..." : "Publicar Anúncio"}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
