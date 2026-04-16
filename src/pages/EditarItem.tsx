import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { ArrowLeft, Plus, X, Loader2 } from "lucide-react";

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

export default function EditarItem({ id, onGoBack }: EditarItemProps) {
  const { user } = useAuth();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [outraCategoria, setOutraCategoria] = useState("");

  const [existingFotos, setExistingFotos] = useState<{ id: number; url: string }[]>([]);
  const [novasFotos, setNovasFotos] = useState<{ file: File; preview: string }[]>([]);

  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    idcategoria: "",
    valor_aluguel_diario: "",
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: cats } = await supabase.from("categoria").select("*");
      if (cats) setCategorias(cats);

      const { data: item, error } = await supabase.from("item").select("*").eq("iditem", id).single();
      if (error || !item) { onGoBack(); return; }

      const { data: fotos } = await supabase.from("fotoitem").select("*").eq("iditem", id).order("ordem_exibicao");
      setExistingFotos((fotos || []).map((f: any) => ({ id: f.idfoto, url: f.url_foto })));

      setFormData({
        nome: item.nome,
        descricao: item.descricao || "",
        idcategoria: String(item.idcategoria),
        valor_aluguel_diario: String(item.valor_aluguel_diario),
      });
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
    const novas = files.map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setNovasFotos((prev) => [...prev, ...novas]);
    e.target.value = "";
  };

  const removerExisting = async (fotoId: number) => {
    await supabase.from("fotoitem").delete().eq("idfoto", fotoId);
    setExistingFotos((prev) => prev.filter((f) => f.id !== fotoId));
  };

  const removerNova = (index: number) => setNovasFotos((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      })
      .eq("iditem", id)
      .eq("idlocador", user!.id)
      .select();

    if (updateError || !data || data.length === 0) {
      setMsg({ type: "error", text: updateError?.message || "Sem permissão para editar este item." });
      setSaving(false);
      return;
    }

    if (novasFotos.length > 0) {
      setUploading(true);
      const ordemBase = existingFotos.length + 1;
      for (let i = 0; i < novasFotos.length; i++) {
        const fileName = `${id}-${Date.now()}-${i}`;
        const { error: uploadError } = await supabase.storage.from("items").upload(fileName, novasFotos[i].file);
        if (!uploadError) {
          const fotoUrl = `https://${process.env.REACT_APP_SUPABASE_URL!.replace("https://", "")}/storage/v1/object/public/items/${fileName}`;
          await supabase.from("fotoitem").insert([{ iditem: id, url_foto: fotoUrl, ordem_exibicao: ordemBase + i }]);
        }
      }
      setUploading(false);
    }

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
                {existingFotos.map((f, i) => (
                  <div key={f.id} className="relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0">
                    <img src={f.url} className="w-full h-full object-cover" alt={`foto ${i + 1}`} />
                    <button type="button" onClick={() => removerExisting(f.id)}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                      <X className="w-3 h-3 text-white" />
                    </button>
                    {i === 0 && <span className="absolute bottom-1 left-1 bg-blue-600 text-white text-[10px] font-bold px-1.5 rounded">Principal</span>}
                  </div>
                ))}
                {novasFotos.map((f, i) => (
                  <div key={`new-${i}`} className="relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0">
                    <img src={f.preview} className="w-full h-full object-cover" alt={`nova ${i + 1}`} />
                    <button type="button" onClick={() => removerNova(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
                <label className="cursor-pointer w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-1 hover:border-blue-400 hover:bg-blue-50 transition flex-shrink-0">
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                  <Plus className="w-6 h-6 text-gray-400" />
                  <span className="text-xs text-gray-400">Adicionar</span>
                </label>
              </div>
            </div>

            {/* INFORMAÇÕES */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              <h2 className="font-bold text-gray-900">Informações do item</h2>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Título *</label>
                <input type="text" name="nome" value={formData.nome} onChange={handleChange}
                  placeholder="Ex: Furadeira elétrica 800W" className={`${inputClass} mt-1`} required />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Categoria *</label>
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
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Descrição</label>
                <textarea name="descricao" value={formData.descricao} onChange={handleChange}
                  placeholder="Descreva o item, estado de conservação, acessórios inclusos..."
                  className={`${inputClass} mt-1 min-h-28 resize-none`} />
              </div>
            </div>

            {/* PREÇOS */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              <h2 className="font-bold text-gray-900">Preços</h2>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Valor por diária (R$) *</label>
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
