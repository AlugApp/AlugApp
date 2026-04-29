import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { ArrowLeft, Plus, X, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DIAS_SEMANA = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

function CalendarioDisponibilidade({ datasIndisponiveis, onChange }: { datasIndisponiveis: string[]; onChange: (d: string[]) => void }) {
  const hoje = new Date();
  const [mesAtual, setMesAtual] = useState(hoje.getMonth());
  const [anoAtual, setAnoAtual] = useState(hoje.getFullYear());
  const primeiroDia = new Date(anoAtual, mesAtual, 1).getDay();
  const totalDias = new Date(anoAtual, mesAtual + 1, 0).getDate();
  const toKey = (d: number) => `${anoAtual}-${String(mesAtual+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}-${String(hoje.getDate()).padStart(2,"0")}`;
  const cells: (number|null)[] = [...Array(primeiroDia).fill(null), ...Array.from({length:totalDias},(_,i)=>i+1)];
  const toggleDia = (dia: number) => {
    const key = toKey(dia);
    onChange(datasIndisponiveis.includes(key) ? datasIndisponiveis.filter(x=>x!==key) : [...datasIndisponiveis, key]);
  };
  const prevMes = () => { if(mesAtual===0){setMesAtual(11);setAnoAtual(a=>a-1);}else setMesAtual(m=>m-1); };
  const nextMes = () => { if(mesAtual===11){setMesAtual(0);setAnoAtual(a=>a+1);}else setMesAtual(m=>m+1); };
  return (
    <div className="max-w-xs">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMes} className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center"><ChevronLeft className="w-3 h-3 text-gray-500"/></button>
        <span className="text-xs font-semibold text-gray-700">{MESES[mesAtual]} {anoAtual}</span>
        <button type="button" onClick={nextMes} className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center"><ChevronRight className="w-3 h-3 text-gray-500"/></button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-0.5">{DIAS_SEMANA.map(d=><div key={d} className="text-center text-[9px] font-semibold text-gray-400">{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((dia,i)=>{
          if(!dia) return <div key={i}/>;
          const key=toKey(dia), passado=key<hojeStr, indisponivel=datasIndisponiveis.includes(key);
          return <button key={i} type="button" onClick={()=>!passado&&toggleDia(dia)} disabled={passado}
            className={`h-6 rounded text-[10px] font-medium transition ${passado?"text-gray-300 cursor-not-allowed":indisponivel?"bg-red-100 text-red-600 border border-red-200":"bg-white border border-gray-200 hover:border-blue-300 text-gray-700"}`}>{dia}</button>;
        })}
      </div>
      <div className="flex gap-4 mt-2 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-100 border border-red-200 inline-block"/> Indisponível</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-white border border-gray-200 inline-block"/> Disponível</span>
      </div>
    </div>
  );
}

type FotoDisplay =
  | { kind: "existing"; id: number; url: string }
  | { kind: "new"; file: File; preview: string };

interface Categoria {
  idcategoria: number;
  nome_categoria: string;
}

interface EditarItemProps {
  id: number;
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


export default function EditarItem({ id, onGoBack }: EditarItemProps) {
  const { user } = useAuth();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [outraCategoria, setOutraCategoria] = useState("");
  const [adicionaisSelecionados, setAdicionaisSelecionados] = useState<string[]>([]);
  const [datasIndisponiveis, setDatasIndisponiveis] = useState<string[]>([]);
  const [fotos, setFotos] = useState<FotoDisplay[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    idcategoria: "",
    valor_aluguel_diario: "",
    estado: "",
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: cats } = await supabase.from("categoria").select("*");
      if (cats) setCategorias(cats);

      const { data: item, error } = await supabase.from("item").select("*").eq("iditem", id).single();
      if (error || !item) { onGoBack(); return; }

      const { data: fotosData } = await supabase.from("fotoitem").select("*").eq("iditem", id).order("ordem_exibicao");
      setFotos((fotosData || []).map((f: any) => ({ kind: "existing" as const, id: f.idfoto, url: f.url_foto })));

      const descricaoRaw = item.descricao || "";
      const match = descricaoRaw.match(/^\[(.+?)\]\s*([\s\S]*)/);
      if (match) setOutraCategoria(match[1]);

      setFormData({
        nome: item.nome,
        descricao: match ? match[2] : descricaoRaw,
        idcategoria: String(item.idcategoria),
        valor_aluguel_diario: String(item.valor_aluguel_diario),
        estado: item.estado || "",
      });
      setAdicionaisSelecionados(Array.isArray(item.adicionais) ? item.adicionais : []);
      setDatasIndisponiveis(Array.isArray(item.datas_indisponiveis) ? item.datas_indisponiveis : []);
      setLoading(false);
    };
    load();
  }, [id]);

  const categoriaSelecionada = categorias.find((c) => String(c.idcategoria) === formData.idcategoria);
  const isOutros = categoriaSelecionada?.nome_categoria?.toLowerCase() === "outros";

  const diario = Number(formData.valor_aluguel_diario) || 0;
  const semanal = diario > 0 ? +(diario * 7 * 0.9).toFixed(2) : 0;
  const mensal  = diario > 0 ? +(diario * 30 * 0.8).toFixed(2) : 0;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const novas: FotoDisplay[] = files.map(file => ({ kind: "new", file, preview: URL.createObjectURL(file) }));
    setFotos(prev => [...prev, ...novas]);
    e.target.value = "";
  };

  const removerFoto = async (index: number) => {
    const foto = fotos[index];
    if (foto.kind === "existing") {
      await supabase.from("fotoitem").delete().eq("idfoto", foto.id);
    }
    setFotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) return;
    const updated = [...fotos];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    setFotos(updated);
    setDragIndex(null);
  };

  const toggleAdicional = (op: string) => {
    setAdicionaisSelecionados((prev) =>
      prev.includes(op) ? prev.filter((x) => x !== op) : [...prev, op]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.estado || !formData.descricao.trim()) {
      setMsg({ type: "error", text: "Preencha todos os campos obrigatórios." });
      return;
    }
    if (isOutros && !outraCategoria.trim()) {
      setMsg({ type: "error", text: "Descreva o tipo do item para a categoria Outros." });
      return;
    }
    setSaving(true);
    setMsg(null);

    const descricaoFinal = isOutros && outraCategoria.trim()
      ? `[${outraCategoria.trim()}] ${formData.descricao}`.trim()
      : formData.descricao;

    const { data, error: updateError } = await supabase
      .from("item")
      .update({
        nome: formData.nome,
        descricao: descricaoFinal,
        idcategoria: Number(formData.idcategoria),
        valor_aluguel_diario: diario,
        valor_aluguel_semana: semanal,
        valor_aluguel_mensal: mensal,
        estado: formData.estado || null,
        adicionais: adicionaisSelecionados.length > 0 ? adicionaisSelecionados : null,
        datas_indisponiveis: datasIndisponiveis.length > 0 ? datasIndisponiveis : null,
      })
      .eq("iditem", id)
      .eq("idlocador", user!.id)
      .select();

    if (updateError || !data || data.length === 0) {
      setMsg({ type: "error", text: updateError?.message || "Sem permissão para editar este item." });
      setSaving(false);
      return;
    }

    setUploading(true);

    // Passo 1: mover fotos existentes para offset alto para evitar conflito de unique constraint
    for (let i = 0; i < fotos.length; i++) {
      if (fotos[i].kind === "existing") {
        await supabase.from("fotoitem").update({ ordem_exibicao: 1000 + i }).eq("idfoto", (fotos[i] as any).id);
      }
    }

    // Passo 2: definir a ordem final e fazer upload de novas fotos
    for (let i = 0; i < fotos.length; i++) {
      const foto = fotos[i];
      if (foto.kind === "existing") {
        await supabase.from("fotoitem").update({ ordem_exibicao: i + 1 }).eq("idfoto", foto.id);
      } else {
        const fileName = `${id}-${Date.now()}-${i}`;
        const { error: uploadError } = await supabase.storage.from("items").upload(fileName, foto.file);
        if (!uploadError) {
          const fotoUrl = `https://${process.env.REACT_APP_SUPABASE_URL!.replace("https://", "")}/storage/v1/object/public/items/${fileName}`;
          await supabase.from("fotoitem").insert([{ iditem: id, url_foto: fotoUrl, ordem_exibicao: i + 1 }]);
        }
      }
    }
    setUploading(false);

    setMsg({ type: "success", text: "Anúncio atualizado com sucesso!" });
    setTimeout(() => onGoBack(), 1500);
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">

      <header className="bg-white shadow-sm flex items-center gap-3 px-6 py-4 flex-shrink-0">
        <button onClick={onGoBack} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Editar Anúncio</h1>
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
                {fotos.map((f, i) => {
                  const src = f.kind === "existing" ? f.url : f.preview;
                  return (
                    <div
                      key={i}
                      draggable
                      onDragStart={() => handleDragStart(i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(i)}
                      className={`relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 cursor-grab active:cursor-grabbing transition-opacity ${dragIndex === i ? "opacity-40" : "opacity-100"}`}
                    >
                      <img src={src} className="w-full h-full object-cover pointer-events-none" alt={`foto ${i + 1}`} />
                      <button type="button" onClick={() => removerFoto(i)}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                        <X className="w-3 h-3 text-white" />
                      </button>
                      {i === 0 && <span className="absolute bottom-1 left-1 bg-blue-600 text-white text-[10px] font-bold px-1.5 rounded">Principal</span>}
                    </div>
                  );
                })}
                <label className="cursor-pointer w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-1 hover:border-blue-400 hover:bg-blue-50 transition flex-shrink-0">
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                  <Plus className="w-6 h-6 text-gray-400" />
                  <span className="text-xs text-gray-400">Adicionar</span>
                </label>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {fotos.length === 0 ? "A primeira foto adicionada será a principal." : "Arraste as fotos para reordenar. A primeira será a principal."}
              </p>
            </div>

            {/* INFORMAÇÕES */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              <h2 className="font-bold text-gray-900">Informações do item</h2>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Título <span className="text-red-500">*</span></label>
                <input type="text" name="nome" value={formData.nome} onChange={handleChange}
                  placeholder="Ex: Furadeira elétrica 800W" className={`${inputClass} mt-1`} required />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Categoria <span className="text-red-500">*</span></label>
                <select name="idcategoria" value={formData.idcategoria} onChange={handleChange}
                  className={`${inputClass} mt-1`} required>
                  <option value="">Selecione uma categoria</option>
                  {categorias.map((cat) => (
                    <option key={cat.idcategoria} value={cat.idcategoria}>{cat.nome_categoria}</option>
                  ))}
                </select>
                {isOutros && (
                  <div className="mt-3 relative">
                    <input type="text" value={outraCategoria} onChange={(e) => setOutraCategoria(e.target.value)}
                      placeholder="Descreva o tipo do item (ex: Instrumentos musicais)"
                      className={`${inputClass} pr-4`} required maxLength={60} />
                    <span className="absolute right-3 bottom-3 text-xs text-gray-300">{outraCategoria.length}/60</span>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado do item <span className="text-red-500">*</span></label>
                <select name="estado" value={formData.estado} onChange={handleChange} className={`${inputClass} mt-1`} required>
                  <option value="">Selecione o estado</option>
                  {ESTADOS_ITEM.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Descrição <span className="text-red-500">*</span></label>
                <textarea name="descricao" value={formData.descricao} onChange={handleChange}
                  placeholder="Descreva o item, estado de conservação, acessórios inclusos..."
                  className={`${inputClass} mt-1 min-h-28 resize-none`} required />
              </div>
            </div>

            {/* PREÇOS */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              <h2 className="font-bold text-gray-900">Preços</h2>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Valor por diária (R$) <span className="text-red-500">*</span></label>
                <input type="number" name="valor_aluguel_diario" value={formData.valor_aluguel_diario}
                  onChange={handleChange} placeholder="0,00" min="0" step="0.01"
                  className={`${inputClass} mt-1`} required />
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
              <p className="text-xs text-gray-400 mb-4">Clique nos dias em que o item <strong>não</strong> estará disponível.</p>
              <CalendarioDisponibilidade datasIndisponiveis={datasIndisponiveis} onChange={setDatasIndisponiveis} />
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

            {/* BOTÕES */}
            <div className="flex gap-3 pb-8">
              <button type="button" onClick={onGoBack}
                className="flex-1 h-12 border border-gray-200 rounded-xl text-gray-700 font-semibold text-sm hover:bg-gray-50 transition">
                Cancelar
              </button>
              <button type="submit" disabled={saving || uploading}
                className="flex-1 h-12 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-60 flex items-center justify-center gap-2">
                {saving || uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {saving || uploading ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
