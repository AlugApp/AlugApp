import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { Upload, DollarSign, MapPin, Save, ArrowLeft, Loader2 } from "lucide-react";

interface Categoria {
  idcategoria: number;
  nome_categoria: string;
}

interface EditarItemProps {
  id: number;
  onGoBack: () => void;
}

export default function EditarItem({ id, onGoBack }: EditarItemProps) {
  const { user } = useAuth();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    idcategoria: "",
    valor_aluguel_diario: "",
    localizacao: "",
    contato: "",
    foto_preview: "",
    foto_file: null as File | null,
    existing_foto_id: null as number | null,
  });

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadInitialData = async () => {
    setLoading(true);
    
    // Carregar categorias
    const { data: cats } = await supabase.from("categoria").select("*");
    if (cats) setCategorias(cats);

    // Carregar dados do item
    const { data: item, error } = await supabase
      .from("item")
      .select("*")
      .eq("iditem", id)
      .single();

    if (error || !item) {
      alert("Erro ao carregar dados do item.");
      onGoBack();
      return;
    }

    // Carregar foto atual
    const { data: foto } = await supabase
      .from("fotoitem")
      .select("*")
      .eq("iditem", id)
      .order("ordem_exibicao")
      .maybeSingle();

    setFormData({
      nome: item.nome,
      descricao: item.descricao,
      idcategoria: String(item.idcategoria),
      valor_aluguel_diario: String(item.valor_aluguel_diario),
      localizacao: item.localizacao || "",
      contato: item.contato || "",
      foto_preview: foto?.url_foto || "",
      foto_file: null,
      existing_foto_id: foto?.idfotoitem || null,
    });

    setLoading(false);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFormData((p) => ({
      ...p,
      foto_file: file,
      foto_preview: URL.createObjectURL(file),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (!user) return;

    // 1️⃣ Atualizar item
    const { data, error: updateError } = await supabase
      .from("item")
      .update({
        nome: formData.nome,
        descricao: formData.descricao,
        idcategoria: Number(formData.idcategoria),
        valor_aluguel_diario: Number(formData.valor_aluguel_diario),
      })
      .eq("iditem", id)
      .eq("idlocador", user.id)
      .select();

    if (updateError) {
      console.error("Erro ao atualizar item:", updateError);
      alert("Erro ao atualizar item: " + updateError.message);
      setSaving(false);
      return;
    }

    if (!data || data.length === 0) {
      alert("Erro: Você não tem permissão para editar este item.");
      setSaving(false);
      return;
    }

    // 2️⃣ Se houver nova foto, enviar ao Storage
    if (formData.foto_file) {
      setUploading(true);
      const fileName = `${id}-${Date.now()}`;
      const { error: uploadError } = await supabase.storage
        .from("items")
        .upload(fileName, formData.foto_file);

      if (!uploadError) {
        const fotoUrl = `https://${process.env.REACT_APP_SUPABASE_URL!.replace(
          "https://",
          ""
        )}/storage/v1/object/public/items/${fileName}`;

        // Atualizar ou inserir na tabela fotoitem
        if (formData.existing_foto_id) {
          await supabase
            .from("fotoitem")
            .update({ url_foto: fotoUrl })
            .eq("idfotoitem", formData.existing_foto_id);
        } else {
          await supabase.from("fotoitem").insert([
            { iditem: id, url_foto: fotoUrl, ordem_exibicao: 1 },
          ]);
        }
      }
      setUploading(false);
    }

    setSaving(false);
    alert("Anúncio atualizado com sucesso!");
    onGoBack();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        
        <button onClick={onGoBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6 transition">
          <ArrowLeft className="w-5 h-5" />
          Voltar para meus anúncios
        </button>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar Anúncio</h1>

        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-xl p-6 shadow-sm border space-y-6">

            {/* TITULO */}
            <div>
              <label className="font-semibold text-gray-900">Título *</label>
              <input
                type="text"
                name="nome"
                value={formData.nome}
                onChange={handleChange}
                required
                className="w-full h-12 border rounded-lg px-3 mt-1"
              />
            </div>

            {/* DESCRIÇÃO */}
            <div>
              <label className="font-semibold text-gray-900">Descrição *</label>
              <textarea
                name="descricao"
                value={formData.descricao}
                onChange={handleChange}
                required
                className="w-full min-h-28 border rounded-lg px-3 mt-1"
              />
            </div>

            {/* CATEGORIA E VALOR */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="font-semibold text-gray-900">Categoria *</label>
                <select
                  name="idcategoria"
                  value={formData.idcategoria}
                  onChange={handleChange}
                  required
                  className="w-full h-12 border rounded-lg px-3 mt-1"
                >
                  <option value="">Selecione</option>
                  {categorias.map((cat) => (
                    <option key={cat.idcategoria} value={cat.idcategoria}>
                      {cat.nome_categoria}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-gray-900">Preço por dia (R$) *</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type="number"
                    name="valor_aluguel_diario"
                    value={formData.valor_aluguel_diario}
                    onChange={handleChange}
                    required
                    className="w-full h-12 border rounded-lg pl-10 mt-1"
                  />
                </div>
              </div>
            </div>

            {/* FOTO */}
            <div>
              <label className="font-semibold text-gray-900">Foto do item</label>
              <label className="border-2 border-dashed rounded-xl h-40 flex items-center justify-center cursor-pointer bg-gray-50 hover:bg-gray-100 mt-2">
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                {!formData.foto_preview ? (
                  <div className="text-center text-gray-500">
                    <Upload className="mx-auto mb-2" />
                    Alterar foto
                  </div>
                ) : (
                  <img
                    src={formData.foto_preview}
                    className="h-32 object-contain mx-auto"
                    alt="preview"
                  />
                )}
              </label>
              {uploading && <p className="text-blue-600 mt-1">Enviando nova foto...</p>}
            </div>

            {/* BOTÕES */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={onGoBack}
                className="w-1/2 h-12 border rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving}
                className="w-1/2 h-12 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                Salvar Alterações
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
