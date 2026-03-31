import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { Upload, DollarSign, MapPin, FileText } from "lucide-react";


interface Categoria {
  idcategoria: number;
  nome_categoria: string;
}

interface AnunciarItemProps {
  onGoBack: () => void;
}

export default function AnunciarItem({ onGoBack }: AnunciarItemProps) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    idcategoria: "",
    valor_aluguel_diario: "",
    localizacao: "",
    contato: "",
    foto_preview: "",
    foto_file: null as File | null
  });

  // 🔥 Carregar categorias do Supabase
  const loadCategorias = async () => {
    const { data, error } = await supabase.from("categoria").select("*");
    if (!error && data) setCategorias(data);
  };

  useEffect(() => {
    loadCategorias();
  }, []);

  // 📌 Atualizar campos
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 📸 Upload da imagem
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFormData((p) => ({
      ...p,
      foto_file: file,
      foto_preview: URL.createObjectURL(file),
    }));
  };

  // 🚀 Enviar item ao Supabase
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1️⃣ Criar item
    const { data: itemCreated, error } = await supabase
      .from("item")
      .insert([
        {
          nome: formData.nome,
          descricao: formData.descricao,
          idcategoria: Number(formData.idcategoria),
          valor_aluguel_diario: Number(formData.valor_aluguel_diario),
        },
      ])
      .select()
      .single();

    if (error) {
      alert("Erro ao criar item.");
      return;
    }

    // 2️⃣ Enviar foto ao Storage
    let fotoUrl = null;

    if (formData.foto_file) {
      setUploading(true);

      const fileName = `${itemCreated.iditem}-${Date.now()}`;
      const { error: uploadError } = await supabase.storage
        .from("items")
        .upload(fileName, formData.foto_file);

      if (!uploadError) {
        fotoUrl = `https://${process.env.REACT_APP_SUPABASE_URL!.replace(
          "https://",
          ""
        )}/storage/v1/object/public/items/${fileName}`;

        // 3️⃣ Criar registro na tabela fotoitem
        await supabase.from("fotoitem").insert([
          {
            iditem: itemCreated.iditem,
            url_foto: fotoUrl,
            ordem_exibicao: 1,
          },
        ]);
      }

      setUploading(false);
    }

    alert("Anúncio criado com sucesso!");
    onGoBack();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* TÍTULO */}
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Criar Anúncio</h1>

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
                placeholder="Ex: Furadeira elétrica"
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
                placeholder="Descreva o item..."
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
                    placeholder="0,00"
                    className="w-full h-12 border rounded-lg pl-10 mt-1"
                  />
                </div>
              </div>
            </div>

            {/* LOCALIZAÇÃO */}
            <div>
              <label className="font-semibold text-gray-900">Localização</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  name="localizacao"
                  value={formData.localizacao}
                  onChange={handleChange}
                  placeholder="Ex: Bloco A - 302"
                  className="w-full h-12 border rounded-lg pl-10 mt-1"
                />
              </div>
            </div>

            {/* CONTATO */}
            <div>
              <label className="font-semibold text-gray-900">Contato</label>
              <input
                type="text"
                name="contato"
                value={formData.contato}
                onChange={handleChange}
                placeholder="(11) 99999-9999"
                className="w-full h-12 border rounded-lg px-3 mt-1"
              />
            </div>

            {/* FOTO */}
            <div>
              <label className="font-semibold text-gray-900">Foto do item</label>

              <label className="border-2 border-dashed rounded-xl h-40 flex items-center justify-center cursor-pointer bg-gray-50 hover:bg-gray-100 mt-2">
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                {!formData.foto_preview ? (
                  <div className="text-center text-gray-500">
                    <Upload className="mx-auto mb-2" />
                    Clique para enviar uma foto
                  </div>
                ) : (
                  <img
                    src={formData.foto_preview}
                    className="h-32 object-contain mx-auto"
                    alt="preview"
                  />
                )}
              </label>

              {uploading && <p className="text-blue-600 mt-1">Enviando...</p>}
            </div>

            {/* BOTÕES */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={onGoBack}
                className="w-1/2 h-12 border rounded-lg text-gray-700"
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="w-1/2 h-12 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
              >
                <FileText className="inline mr-2" />
                Publicar Anúncio
              </button>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}
