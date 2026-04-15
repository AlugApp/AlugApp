import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import {
  Package,
  Home as HomeIcon,
  PlusCircle,
  MessageSquare,
  User,
  Trash2,
} from "lucide-react";

interface MeusAnunciosProps {
  onGoBack: () => void;
  onGoToPerfil: () => void;
  onGoToAnnounce: () => void;
  onOpenItem: (id: number) => void;
  onEditItem: (id: number) => void;
}

interface Item {
  iditem: number;
  nome: string;
  descricao: string;
  valor_aluguel_diario: number;
  foto_url?: string | null;
  nome_categoria?: string;
  created_at?: string;
}

export default function MeusAnuncios({ onGoBack, onGoToPerfil, onGoToAnnounce, onOpenItem, onEditItem }: MeusAnunciosProps) {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMyItems = async () => {
    if (!user?.id) return;
    setLoading(true);

    const { data: itemsData, error } = await supabase
      .from("item")
      .select("*, categoria(nome_categoria)")
      .eq("idlocador", user.id)
      .order("created_at", { ascending: false });

    if (error || !itemsData) {
      setLoading(false);
      return;
    }

    const { data: fotos } = await supabase
      .from("fotoitem")
      .select("*")
      .order("ordem_exibicao", { ascending: true });

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
    if (user?.id) {
      loadMyItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleDelete = async (id: number) => {
    if (!window.confirm("Tem certeza que deseja excluir este anúncio?")) return;

    if (!user) return;

    // 1️⃣ Apagar as referências de fotos primeiro (para evitar erro de chave estrangeira)
    const { error: photoError } = await supabase
      .from("fotoitem")
      .delete()
      .eq("iditem", id);

    if (photoError) {
      console.error("Erro ao apagar fotos:", photoError);
      alert("Erro ao remover fotos do item: " + photoError.message);
      return;
    }

    // 2️⃣ Agora sim apagamos o item
    const { data, error } = await supabase
      .from("item")
      .delete()
      .eq("iditem", id)
      .eq("idlocador", user.id)
      .select();

    if (error) {
      console.error("Erro ao excluir:", error);
      alert("Erro ao excluir item: " + error.message);
    } else if (!data || data.length === 0) {
      alert("Erro: Você não tem permissão para excluir este item.");
    } else {
      setItems(items.filter((item) => item.iditem !== id));
      alert("Item excluído com sucesso!");
    }
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
          className="mr-4 flex items-center gap-2 bg-blue-700 text-white px-5 py-2.5 rounded-full font-semibold text-sm hover:bg-blue-800 transition"
        >
          <PlusCircle className="w-5 h-5" />
          Anunciar Item
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Meus Anúncios</h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-80 bg-gray-200 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
            <Package className="w-14 h-14 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Você ainda não anunciou nada</h3>
            <p className="text-gray-400 text-sm mb-6">Que tal começar agora?</p>
            <button
               onClick={onGoToAnnounce}
               className="bg-blue-700 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-800 transition"
            >
              Anunciar Primeiro Item
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {items.map((item) => (
              <div key={item.iditem} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition flex flex-col">
                <div className="relative">
                  <img
                    src={item.foto_url || "https://via.placeholder.com/300x200?text=Sem+Imagem"}
                    className="w-full h-48 object-cover"
                    alt={item.nome}
                  />
                  <button
                    onClick={() => handleDelete(item.iditem)}
                    className="absolute top-2 right-2 p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-bold text-gray-900 text-sm truncate">{item.nome}</h3>
                  <p className="text-green-600 font-semibold text-sm mt-0.5">
                    R$ {Number(item.valor_aluguel_diario).toFixed(2)}/dia
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{item.nome_categoria}</p>
                  
                  <div className="mt-auto pt-4 flex gap-2">
                    <button
                      onClick={() => onOpenItem(item.iditem)}
                      className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl text-xs font-semibold hover:bg-gray-200 transition"
                    >
                      Ver Detalhes
                    </button>
                    <button
                      onClick={() => onEditItem(item.iditem)}
                      className="flex-1 bg-blue-50 text-blue-600 py-2 rounded-xl text-xs font-semibold hover:bg-blue-100 transition"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-16 flex justify-around items-center px-4">
        <button onClick={onGoBack} className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600 transition">
          <HomeIcon className="w-6 h-6" />
          <span className="text-xs">Início</span>
        </button>
        <button className="flex flex-col items-center gap-0.5 text-blue-600">
          <PlusCircle className="w-6 h-6" />
          <span className="text-xs font-medium">Meus Anúncios</span>
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
