import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import {
  isAdmin,
  isUserBanned,
  banUser,
  unbanUser,
  forceDeleteItem,
  updateItemPricing,
  promoteToAdmin,
} from '../lib/admin';
import {
  Shield,
  ShieldAlert,
  ArrowLeft,
  Users,
  Package,
  Search,
  Trash2,
  UserX,
  UserCheck,
  Edit3,
  Percent,
  MessageSquare,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Tag,
} from 'lucide-react';

interface AdminProps {
  onGoBack: () => void;
  onGoToPerfil: () => void;
  onGoToChatWithUser?: (userId: number, userName: string) => void;
  onOpenItem?: (id: number) => void;
}

interface UserItem {
  id: number;
  auth_id: string;
  fullName: string;
  email: string;
  cpf?: string;
  phone?: string;
  cidade?: string;
  estado?: string;
  created_at?: string;
  avatar_url?: string;
  item_count?: number;
}

interface ItemRecord {
  iditem: number;
  nome: string;
  descricao?: string;
  valor_aluguel_diario: number;
  valor_aluguel_semana: number;
  valor_aluguel_mensal: number;
  desconto_percentual?: number | null;
  disponivel: boolean;
  idlocador: string;
  created_at: string;
  foto_url?: string;
  locador_name?: string;
  locador_email?: string;
  locador_id?: number;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function Admin({
  onGoBack,
  onGoToChatWithUser,
  onOpenItem,
}: AdminProps) {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<'users' | 'items'>('items');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Dados
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [itemsList, setItemsList] = useState<ItemRecord[]>([]);

  // Filtros
  const [searchUsers, setSearchUsers] = useState('');
  const [searchItems, setSearchItems] = useState('');

  // Modal de edição de preços/descontos
  const [editingItem, setEditingItem] = useState<ItemRecord | null>(null);
  const [editPrices, setEditPrices] = useState({
    diario: 0,
    semana: 0,
    mensal: 0,
    desconto: 0,
  });
  const [savingPrices, setSavingPrices] = useState(false);

  // Modal de confirmação de exclusão
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);
  const [deletingItemName, setDeletingItemName] = useState('');
  const [actionInProgress, setActionInProgress] = useState(false);

  // Modal de promoção a Administrador com autenticação
  const [promotingTarget, setPromotingTarget] = useState<UserItem | null>(null);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Carregar dados gerais
  const loadData = useCallback(async () => {
    setLoading(true);
    setFeedback(null);

    try {
      // 1. Carrega todos os usuários
      const { data: usersData, error: usersErr } = await supabase
        .from('users')
        .select('*')
        .order('id', { ascending: false });

      if (usersErr) throw usersErr;

      // 2. Carrega todos os itens com suas fotos
      const { data: itemsData, error: itemsErr } = await supabase
        .from('item')
        .select('*')
        .order('iditem', { ascending: false });

      if (itemsErr) throw itemsErr;

      // 3. Carrega fotos para compor capa
      const itemIds = (itemsData || []).map((i: any) => i.iditem);
      const { data: fotosData } = await supabase
        .from('fotoitem')
        .select('iditem, url_foto, ordem_exibicao')
        .in('iditem', itemIds);

      // Mapeia fotos de capa
      const fotoMap = new Map<number, string>();
      (fotosData || []).forEach((f: any) => {
        if (!fotoMap.has(f.iditem) || f.ordem_exibicao === 1) {
          fotoMap.set(f.iditem, f.url_foto);
        }
      });

      // Mapeia contagem de itens por locador (auth_id)
      const itemCountMap = new Map<string, number>();
      (itemsData || []).forEach((i: any) => {
        if (i.idlocador) {
          itemCountMap.set(i.idlocador, (itemCountMap.get(i.idlocador) || 0) + 1);
        }
      });

      // Usuário map por auth_id
      const userByAuthId = new Map<string, any>();
      (usersData || []).forEach((u: any) => {
        if (u.auth_id) userByAuthId.set(u.auth_id, u);
      });

      const formattedUsers: UserItem[] = (usersData || []).map((u: any) => ({
        ...u,
        item_count: itemCountMap.get(u.auth_id) || 0,
      }));

      const formattedItems: ItemRecord[] = (itemsData || []).map((i: any) => {
        const loc = userByAuthId.get(i.idlocador);
        return {
          iditem: i.iditem,
          nome: i.nome,
          descricao: i.descricao,
          valor_aluguel_diario: Number(i.valor_aluguel_diario || 0),
          valor_aluguel_semana: Number(i.valor_aluguel_semana || 0),
          valor_aluguel_mensal: Number(i.valor_aluguel_mensal || 0),
          desconto_percentual: i.desconto_percentual !== null && i.desconto_percentual !== undefined ? Number(i.desconto_percentual) : null,
          disponivel: !!i.disponivel,
          idlocador: i.idlocador,
          created_at: i.created_at,
          foto_url: fotoMap.get(i.iditem),
          locador_name: loc?.fullName || 'Usuário Desconhecido',
          locador_email: loc?.email || '',
          locador_id: loc?.id,
        };
      });

      setUsersList(formattedUsers);
      setItemsList(formattedItems);
    } catch (err: any) {
      console.error('[Admin] Erro ao carregar dados:', err);
      setFeedback({ type: 'error', text: err?.message || 'Falha ao carregar dados do painel.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Ações de Moderação de Usuários ──────────────────────────────────────────

  const handleBanToggle = async (targetUser: UserItem) => {
    const isTargetAdmin = isAdmin({ email: targetUser.email }, { email: targetUser.email });
    if (isTargetAdmin) {
      alert('Operação proibida: Administradores do sistema não podem ser banidos.');
      return;
    }

    const currentlyBanned = isUserBanned(targetUser.email) || isUserBanned(targetUser.id);
    if (currentlyBanned) {
      if (!window.confirm(`Deseja revogar o banimento de ${targetUser.fullName}?`)) return;
      setActionInProgress(true);
      const res = await unbanUser({ id: targetUser.id, auth_id: targetUser.auth_id, email: targetUser.email });
      setActionInProgress(false);
      setFeedback({ type: res.success ? 'success' : 'error', text: res.message });
      loadData();
    } else {
      if (
        !window.confirm(
          `Tem certeza que deseja BANIR o usuário ${targetUser.fullName}? Ele perderá o acesso imediato à plataforma.`
        )
      ) {
        return;
      }
      setActionInProgress(true);
      const res = await banUser({
        id: targetUser.id,
        auth_id: targetUser.auth_id,
        email: targetUser.email,
        fullName: targetUser.fullName,
      });
      setActionInProgress(false);
      setFeedback({ type: res.success ? 'success' : 'error', text: res.message });
      loadData();
    }
  };

  // ─── Ações de Moderação de Anúncios ──────────────────────────────────────────

  const handleOpenDeleteModal = (item: ItemRecord) => {
    setDeletingItemId(item.iditem);
    setDeletingItemName(item.nome);
  };

  const handleConfirmDelete = async () => {
    if (!deletingItemId) return;
    setActionInProgress(true);
    const res = await forceDeleteItem(deletingItemId);
    setActionInProgress(false);
    setDeletingItemId(null);
    setDeletingItemName('');
    setFeedback({ type: res.success ? 'success' : 'error', text: res.message });
    if (res.success) {
      setItemsList((prev) => prev.filter((i) => i.iditem !== deletingItemId));
    }
  };

  // ─── Promoção de Administrador com Chave de Segurança (.env) ─────────────────
  const handlePromoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promotingTarget) return;

    setAuthLoading(true);
    setAuthError(null);

    const requiredSecret = process.env.REACT_APP_ADMIN_PROMOTION_SECRET;
    if (!requiredSecret) {
      setAuthLoading(false);
      setAuthError('Chave de segurança não configurada no ambiente (.env).');
      return;
    }

    if (authPassword.trim() !== requiredSecret.trim()) {
      setAuthLoading(false);
      setAuthError('Senha de segurança incorreta. Acesso negado.');
      return;
    }

    const res = await promoteToAdmin({
      id: promotingTarget.id,
      auth_id: promotingTarget.auth_id,
      email: promotingTarget.email,
      fullName: promotingTarget.fullName,
    });

    setAuthLoading(false);
    setPromotingTarget(null);
    setAuthPassword('');
    setFeedback({ type: res.success ? 'success' : 'error', text: res.message });
    loadData();
  };

  // ─── Ações de Gestão de Preços e Descontos ────────────────────────────────────

  const handleOpenPriceModal = (item: ItemRecord) => {
    setEditingItem(item);
    setEditPrices({
      diario: item.valor_aluguel_diario,
      semana: item.valor_aluguel_semana,
      mensal: item.valor_aluguel_mensal,
      desconto: item.desconto_percentual || 0,
    });
  };

  const handleSavePrices = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setSavingPrices(true);

    const res = await updateItemPricing(editingItem.iditem, {
      diario: Number(editPrices.diario),
      semana: Number(editPrices.semana),
      mensal: Number(editPrices.mensal),
      desconto_percentual: editPrices.desconto > 0 ? Number(editPrices.desconto) : null,
    });

    setSavingPrices(false);
    setEditingItem(null);
    setFeedback({ type: res.success ? 'success' : 'error', text: res.message });

    if (res.success) {
      setItemsList((prev) =>
        prev.map((i) =>
          i.iditem === editingItem.iditem
            ? {
                ...i,
                valor_aluguel_diario: Number(editPrices.diario),
                valor_aluguel_semana: Number(editPrices.semana),
                valor_aluguel_mensal: Number(editPrices.mensal),
                desconto_percentual: editPrices.desconto > 0 ? Number(editPrices.desconto) : null,
              }
            : i
        )
      );
    }
  };

  // ─── Listas filtradas ────────────────────────────────────────────────────────

  const filteredUsers = useMemo(() => {
    const q = searchUsers.toLowerCase().trim();
    if (!q) return usersList;
    return usersList.filter(
      (u) =>
        u.fullName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.cidade?.toLowerCase().includes(q)
    );
  }, [usersList, searchUsers]);

  const filteredItems = useMemo(() => {
    const q = searchItems.toLowerCase().trim();
    if (!q) return itemsList;
    return itemsList.filter(
      (i) =>
        i.nome.toLowerCase().includes(q) ||
        i.locador_name?.toLowerCase().includes(q) ||
        i.locador_email?.toLowerCase().includes(q)
    );
  }, [itemsList, searchItems]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-slate-900 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onGoBack}
                className="p-2 -ml-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition"
                title="Voltar"
              >
                <ArrowLeft size={22} />
              </button>
              <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
                <Shield size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight">Painel de Administração</h1>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                    RBAC Admin
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Operador: <span className="text-slate-200 font-medium">{profile?.fullName || user?.email}</span>
                </p>
              </div>
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-medium"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>

          {/* Abas */}
          <div className="flex gap-2 mt-6">
            <button
              onClick={() => setTab('items')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition ${
                tab === 'items'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Package size={17} />
              <span>Moderação de Anúncios ({itemsList.length})</span>
            </button>
            <button
              onClick={() => setTab('users')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition ${
                tab === 'users'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Users size={17} />
              <span>Moderação de Usuários ({usersList.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Feedback alert */}
        {feedback && (
          <div
            className={`mb-6 p-4 rounded-2xl flex items-center justify-between gap-3 text-sm font-medium ${
              feedback.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
              ) : (
                <AlertTriangle size={18} className="text-red-600 flex-shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-gray-400 hover:text-gray-600 text-base"
            >
              ✕
            </button>
          </div>
        )}

        {/* ─── ABA 1: MODERAÇÃO DE ANÚNCIOS ─────────────────────────────────── */}
        {tab === 'items' && (
          <div className="space-y-4">
            {/* Barra de busca */}
            <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
              <Search size={18} className="text-gray-400 ml-2" />
              <input
                type="text"
                value={searchItems}
                onChange={(e) => setSearchItems(e.target.value)}
                placeholder="Buscar anúncios por título ou anunciante..."
                className="w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
              />
              {searchItems && (
                <button
                  onClick={() => setSearchItems('')}
                  className="text-xs text-gray-400 hover:text-gray-600 mr-2"
                >
                  Limpar
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <RefreshCw size={32} className="animate-spin mb-3 text-blue-600" />
                <p className="text-sm">Carregando anúncios da plataforma...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 text-gray-500">
                <Package size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="font-semibold text-base">Nenhum anúncio encontrado</p>
                <p className="text-xs text-gray-400 mt-1">Tente ajustar a sua busca.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredItems.map((item) => {
                  const hasDiscount =
                    item.desconto_percentual && item.desconto_percentual > 0;
                  const discountedDaily = hasDiscount
                    ? item.valor_aluguel_diario * (1 - item.desconto_percentual! / 100)
                    : item.valor_aluguel_diario;

                  return (
                    <div
                      key={item.iditem}
                      className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                    >
                      <div className="flex gap-3">
                        {/* Foto do item */}
                        <div className="w-20 h-20 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200">
                          {item.foto_url ? (
                            <img
                              src={item.foto_url}
                              alt={item.nome}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                              <Package size={24} />
                            </div>
                          )}
                        </div>

                        {/* Detalhes */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3
                              onClick={() => onOpenItem?.(item.iditem)}
                              className="font-bold text-gray-900 text-sm truncate cursor-pointer hover:text-blue-600 transition"
                            >
                              {item.nome}
                            </h3>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                item.disponivel
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}
                            >
                              {item.disponivel ? 'Disponível' : 'Em aluguel'}
                            </span>
                          </div>

                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            Por: <span className="font-medium text-gray-700">{item.locador_name}</span>
                          </p>

                          {/* Preços e descontos */}
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-blue-700">
                              {fmtBRL(discountedDaily)}/dia
                            </span>
                            {hasDiscount && (
                              <span className="text-[10px] line-through text-gray-400">
                                {fmtBRL(item.valor_aluguel_diario)}
                              </span>
                            )}
                            {hasDiscount && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center gap-0.5">
                                <Percent size={10} /> -{item.desconto_percentual}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Ações Administrativas */}
                      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                        <button
                          onClick={() => handleOpenPriceModal(item)}
                          className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold flex items-center gap-1.5 transition"
                        >
                          <Edit3 size={13} />
                          <span>Preços / Desconto</span>
                        </button>

                        <button
                          onClick={() => handleOpenDeleteModal(item)}
                          className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold flex items-center gap-1.5 transition"
                        >
                          <Trash2 size={13} />
                          <span>Exclusão Forçada</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── ABA 2: MODERAÇÃO DE USUÁRIOS ─────────────────────────────────── */}
        {tab === 'users' && (
          <div className="space-y-4">
            {/* Barra de busca */}
            <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
              <Search size={18} className="text-gray-400 ml-2" />
              <input
                type="text"
                value={searchUsers}
                onChange={(e) => setSearchUsers(e.target.value)}
                placeholder="Buscar usuário por nome, e-mail ou cidade..."
                className="w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
              />
              {searchUsers && (
                <button
                  onClick={() => setSearchUsers('')}
                  className="text-xs text-gray-400 hover:text-gray-600 mr-2"
                >
                  Limpar
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <RefreshCw size={32} className="animate-spin mb-3 text-blue-600" />
                <p className="text-sm">Carregando usuários cadastrados...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 text-gray-500">
                <Users size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="font-semibold text-base">Nenhum usuário encontrado</p>
                <p className="text-xs text-gray-400 mt-1">Tente ajustar a sua busca.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="divide-y divide-gray-100">
                  {filteredUsers.map((u) => {
                    const isTargetAdmin = isAdmin({ email: u.email }, { email: u.email });
                    const isBanned = isUserBanned(u.email) || isUserBanned(u.id);

                    return (
                      <div
                        key={u.id}
                        className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${
                          isBanned ? 'bg-red-50/40' : 'hover:bg-gray-50/80'
                        }`}
                      >
                        {/* Usuário info */}
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden flex items-center justify-center font-bold text-gray-600 text-base">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt={u.fullName} className="w-full h-full object-cover" />
                            ) : (
                              u.fullName?.charAt(0).toUpperCase() || 'U'
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-gray-900 text-sm">{u.fullName}</span>
                              {isTargetAdmin && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                                  <Shield size={10} /> Admin
                                </span>
                              )}
                              {isBanned && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                  <ShieldAlert size={10} /> Banido
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{u.email}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              {u.cidade && u.estado ? `${u.cidade}/${u.estado} • ` : ''}
                              {u.item_count || 0} anúncio(s) ativo(s)
                            </p>
                          </div>
                        </div>

                        {/* Ações */}
                        <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                          {/* Chat direto com o usuário */}
                          <button
                            onClick={() => onGoToChatWithUser?.(u.id, u.fullName)}
                            className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold flex items-center gap-1.5 transition"
                            title="Iniciar conversa direta como Administrador"
                          >
                            <MessageSquare size={14} />
                            <span>Conversar</span>
                          </button>

                          {/* Promoção a Administrador (apenas para não-admins) */}
                          {!isTargetAdmin && (
                            <button
                              onClick={() => {
                                setPromotingTarget(u);
                                setAuthPassword('');
                                setAuthError(null);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold flex items-center gap-1.5 transition border border-purple-200"
                              title="Promover este usuário a Administrador do sistema"
                            >
                              <Shield size={14} className="text-purple-600" />
                              <span>Tornar Admin</span>
                            </button>
                          )}

                          {/* Ação de Banimento com Regra de Proteção para Admins */}
                          {isTargetAdmin ? (
                            <button
                              disabled
                              className="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-400 text-xs font-semibold flex items-center gap-1.5 cursor-not-allowed opacity-60"
                              title="Proteção de Segurança: É proibido banir administradores"
                            >
                              <Shield size={14} />
                              <span>Admin Protegido</span>
                            </button>
                          ) : isBanned ? (
                            <button
                              onClick={() => handleBanToggle(u)}
                              disabled={actionInProgress}
                              className="px-3 py-1.5 rounded-xl bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold flex items-center gap-1.5 transition"
                            >
                              <UserCheck size={14} />
                              <span>Desbanir</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBanToggle(u)}
                              disabled={actionInProgress}
                              className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold flex items-center gap-1.5 transition"
                            >
                              <UserX size={14} />
                              <span>Banir Usuário</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── MODAL DE EDIÇÃO DE PREÇOS E DESCONTOS ─────────────────────────── */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-gray-900 font-bold">
                <Tag className="text-blue-600" size={20} />
                <span>Gestão de Preços e Descontos</span>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="text-gray-400 hover:text-gray-600 text-base"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-2">
              Item: <span className="font-bold text-gray-800">{editingItem.nome}</span>
            </p>

            <form onSubmit={handleSavePrices} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Valor Diário (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-gray-400">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editPrices.diario}
                    onChange={(e) =>
                      setEditPrices((p) => ({ ...p, diario: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Valor Semanal (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editPrices.semana}
                    onChange={(e) =>
                      setEditPrices((p) => ({ ...p, semana: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Valor Mensal (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editPrices.mensal}
                    onChange={(e) =>
                      setEditPrices((p) => ({ ...p, mensal: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Desconto Forçado (%)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-gray-400">%</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="90"
                    value={editPrices.desconto}
                    onChange={(e) =>
                      setEditPrices((p) => ({ ...p, desconto: parseInt(e.target.value) || 0 }))
                    }
                    placeholder="0 para nenhum"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Insira 0 para manter o preço sem desconto adicional.
                </p>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="w-1/2 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-xs hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPrices}
                  className="w-1/2 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition disabled:opacity-60"
                >
                  {savingPrices ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL DE CONFIRMAÇÃO DE EXCLUSÃO FORÇADA ───────────────────────── */}
      {deletingItemId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 size={24} />
            </div>
            <h3 className="font-bold text-gray-900 text-base">Confirmar Exclusão Forçada</h3>
            <p className="text-xs text-gray-500 mt-2">
              Você está prestes a remover o anúncio <strong>"{deletingItemName}"</strong> de forma permanente pela moderação.
            </p>
            <p className="text-[11px] text-red-600 mt-1 font-medium">
              Todas as fotos e conversas vinculadas a este item serão apagadas em cascata.
            </p>

            <div className="flex gap-2 mt-6">
              <button
                type="button"
                onClick={() => setDeletingItemId(null)}
                className="w-1/2 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-xs hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={actionInProgress}
                className="w-1/2 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-xs hover:bg-red-700 transition disabled:opacity-60"
              >
                {actionInProgress ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ─── MODAL DE PROMOÇÃO DE ADMINISTRADOR COM AUTENTICAÇÃO ───────────── */}
      {promotingTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto mb-3">
              <Shield size={24} />
            </div>
            <h3 className="font-bold text-gray-900 text-base text-center">
              Autenticação de Segurança
            </h3>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Você está concedendo privilégios de <strong>Administrador do Sistema</strong> para{' '}
              <strong className="text-gray-800">{promotingTarget.fullName}</strong> ({promotingTarget.email}).
            </p>
            <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-3 text-center">
              Administradores possuem acesso irrestrito ao painel, moderação de anúncios, banimento de contas e gestão de preços.
            </p>

            {authError && (
              <div className="mt-3 p-2.5 rounded-xl bg-red-50 text-red-700 text-xs font-medium text-center border border-red-200">
                {authError}
              </div>
            )}

            <form onSubmit={handlePromoteSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Senha de Segurança de Administrador
                </label>
                <input
                  type="password"
                  required
                  placeholder="Digite a senha de segurança"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  disabled={authLoading}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Informe a chave de segurança para autorizar a promoção deste usuário.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={() => setPromotingTarget(null)}
                  className="w-1/2 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-xs hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-1/2 py-2.5 rounded-xl bg-purple-600 text-white font-semibold text-xs hover:bg-purple-700 transition disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  {authLoading ? 'Verificando...' : 'Confirmar e Promover'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
