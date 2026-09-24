import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import {
  isAdmin,
  isUserBanned,
  banUser,
  unbanUser,
  forceDeleteItem,
  deleteUserAccount,
  deleteAvaliacao,
  updateItemPricing,
  promoteToAdmin,
  addAdminAuditLog,
  getAdminAuditLogs,
  clearAdminAuditLogs,
  AdminAuditLog,
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
  Repeat,
  Star,
  FileText,
  Calendar,
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

interface RentalRecord {
  idtransacao?: number;
  idsolicitacao: number;
  iditem: number;
  item_nome: string;
  item_foto?: string;
  locador_nome: string;
  locador_email: string;
  locatario_nome: string;
  locatario_email: string;
  data_inicio: string;
  data_fim: string;
  valor_total: number;
  status: string;
  status_pagamento?: string;
  status_devolucao?: string;
  data_criacao: string;
}

interface ReviewRecord {
  idavaliacao: number;
  idavaliador: number;
  idavaliado: number;
  avaliador_nome: string;
  avaliador_email: string;
  avaliado_nome: string;
  avaliado_email: string;
  comentario: string;
  nota: number;
  data_avaliacao: string;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function Admin({
  onGoBack,
  onGoToChatWithUser,
  onOpenItem,
}: AdminProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<'items' | 'users' | 'rentals' | 'reviews' | 'logs'>('items');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Listas de dados
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [itemsList, setItemsList] = useState<ItemRecord[]>([]);
  const [rentalsList, setRentalsList] = useState<RentalRecord[]>([]);
  const [reviewsList, setReviewsList] = useState<ReviewRecord[]>([]);
  const [auditLogsList, setAuditLogsList] = useState<AdminAuditLog[]>([]);

  // Filtros
  const [searchUsers, setSearchUsers] = useState('');
  const [searchItems, setSearchItems] = useState('');
  const [searchRentals, setSearchRentals] = useState('');
  const [searchReviews, setSearchReviews] = useState('');
  const [searchLogs, setSearchLogs] = useState('');

  // Modais de Anúncios
  const [editingItem, setEditingItem] = useState<ItemRecord | null>(null);
  const [editPrices, setEditPrices] = useState({
    diario: 0,
    semana: 0,
    mensal: 0,
    desconto: 0,
  });
  const [savingPrices, setSavingPrices] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);
  const [deletingItemName, setDeletingItemName] = useState('');

  // Modal de Exclusão de Conta de Usuário
  const [deletingUserTarget, setDeletingUserTarget] = useState<UserItem | null>(null);

  // Modal de Promoção a Administrador
  const [promotingTarget, setPromotingTarget] = useState<UserItem | null>(null);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Modal de Exclusão de Avaliação
  const [deletingReviewId, setDeletingReviewId] = useState<number | null>(null);

  const [actionInProgress, setActionInProgress] = useState(false);

  // ─── Carregar todos os dados do painel ──────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setFeedback(null);

    try {
      // 1. Carrega Usuários
      const { data: usersData, error: usersErr } = await supabase
        .from('users')
        .select('*')
        .order('id', { ascending: false });

      if (usersErr) throw usersErr;

      // 2. Carrega Itens e Fotos
      const { data: itemsData, error: itemsErr } = await supabase
        .from('item')
        .select('*')
        .order('iditem', { ascending: false });

      if (itemsErr) throw itemsErr;

      const itemIds = (itemsData || []).map((i: any) => i.iditem);
      const { data: fotosData } = await supabase
        .from('fotoitem')
        .select('iditem, url_foto, ordem_exibicao')
        .in('iditem', itemIds);

      const fotoMap = new Map<number, string>();
      (fotosData || []).forEach((f: any) => {
        if (!fotoMap.has(f.iditem) || f.ordem_exibicao === 1) {
          fotoMap.set(f.iditem, f.url_foto);
        }
      });

      const itemCountMap = new Map<string, number>();
      (itemsData || []).forEach((i: any) => {
        if (i.idlocador) {
          itemCountMap.set(i.idlocador, (itemCountMap.get(i.idlocador) || 0) + 1);
        }
      });

      const userByAuthId = new Map<string, any>();
      const userById = new Map<number, any>();
      (usersData || []).forEach((u: any) => {
        if (u.auth_id) userByAuthId.set(u.auth_id, u);
        if (u.id) userById.set(u.id, u);
      });

      const itemMap = new Map<number, any>();
      (itemsData || []).forEach((it: any) => {
        itemMap.set(it.iditem, it);
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
          desconto_percentual:
            i.desconto_percentual !== null && i.desconto_percentual !== undefined
              ? Number(i.desconto_percentual)
              : null,
          disponivel: !!i.disponivel,
          idlocador: i.idlocador,
          created_at: i.created_at,
          foto_url: fotoMap.get(i.iditem),
          locador_name: loc?.fullName || 'Usuário Desconhecido',
          locador_email: loc?.email || '',
          locador_id: loc?.id,
        };
      });

      // 3. Carrega Aluguéis em Transação (solicitacao_aluguel + transacao_aluguel)
      const { data: solData } = await supabase
        .from('solicitacao_aluguel')
        .select('*')
        .order('idsolicitacao', { ascending: false });

      const { data: transData } = await supabase
        .from('transacao_aluguel')
        .select('*')
        .order('idtransacao', { ascending: false });

      const transBySolId = new Map<number, any>();
      (transData || []).forEach((t: any) => {
        if (t.idsolicitacao) transBySolId.set(t.idsolicitacao, t);
      });

      const formattedRentals: RentalRecord[] = (solData || []).map((s: any) => {
        const tr = transBySolId.get(s.idsolicitacao);
        const it = itemMap.get(s.iditem);
        const loc = userById.get(s.idlocador);
        const locat = userById.get(s.idlocatario);

        return {
          idsolicitacao: s.idsolicitacao,
          idtransacao: tr?.idtransacao,
          iditem: s.iditem,
          item_nome: it?.nome || `Item #${s.iditem}`,
          item_foto: fotoMap.get(s.iditem),
          locador_nome: loc?.fullName || 'Locador',
          locador_email: loc?.email || '',
          locatario_nome: locat?.fullName || 'Locatário',
          locatario_email: locat?.email || '',
          data_inicio: tr?.data_inicio_real || s.data_inicio_prevista || '',
          data_fim: tr?.data_fim_real || s.data_fim_prevista || '',
          valor_total: Number(tr?.valor_final || s.valor_total_previsto || 0),
          status: s.status || 'pendente',
          status_pagamento: tr?.status_pagamento,
          status_devolucao: tr?.status_devolucao,
          data_criacao: s.data_solicitacao || tr?.data_criacao || '',
        };
      });

      // 4. Carrega Avaliações
      const { data: avData } = await supabase
        .from('avaliacao')
        .select('*')
        .order('idavaliacao', { ascending: false });

      const formattedReviews: ReviewRecord[] = (avData || []).map((a: any) => {
        const avaliador = userById.get(a.idavaliador);
        const avaliado = userById.get(a.idavaliado);
        return {
          idavaliacao: a.idavaliacao,
          idavaliador: a.idavaliador,
          idavaliado: a.idavaliado,
          avaliador_nome: avaliador?.fullName || `Usuário #${a.idavaliador}`,
          avaliador_email: avaliador?.email || '',
          avaliado_nome: avaliado?.fullName || `Usuário #${a.idavaliado}`,
          avaliado_email: avaliado?.email || '',
          comentario: a.comentario || '',
          nota: Number(a.nota || 0),
          data_avaliacao: a.data_avaliacao || '',
        };
      });

      setUsersList(formattedUsers);
      setItemsList(formattedItems);
      setRentalsList(formattedRentals);
      setReviewsList(formattedReviews);
      setAuditLogsList(getAdminAuditLogs());
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

  // ─── Ações de Moderação de Usuários (Ban / Unban) ────────────────────────────

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
      if (res.success) {
        addAdminAuditLog({
          admin_email: user?.email || 'admin',
          action: 'unban_user',
          target: `${targetUser.fullName} (${targetUser.email})`,
          details: `Revogação de banimento do usuário ID ${targetUser.id}`,
        });
      }
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
      if (res.success) {
        addAdminAuditLog({
          admin_email: user?.email || 'admin',
          action: 'ban_user',
          target: `${targetUser.fullName} (${targetUser.email})`,
          details: `Bloqueio e banimento de usuário ID ${targetUser.id}`,
        });
      }
      loadData();
    }
  };

  // ─── Exclusão Definitiva de Conta ───────────────────────────────────────────

  const handleConfirmDeleteUser = async () => {
    if (!deletingUserTarget) return;
    setActionInProgress(true);
    const res = await deleteUserAccount({
      id: deletingUserTarget.id,
      email: deletingUserTarget.email,
      fullName: deletingUserTarget.fullName,
    });
    setActionInProgress(false);
    setDeletingUserTarget(null);
    setFeedback({ type: res.success ? 'success' : 'error', text: res.message });
    if (res.success) {
      addAdminAuditLog({
        admin_email: user?.email || 'admin',
        action: 'delete_user',
        target: `${deletingUserTarget.fullName} (${deletingUserTarget.email})`,
        details: `Exclusão permanente de conta e dados do usuário ID ${deletingUserTarget.id}`,
      });
      setUsersList((prev) => prev.filter((u) => u.id !== deletingUserTarget.id));
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
    const deletedName = deletingItemName;
    const deletedId = deletingItemId;
    setDeletingItemId(null);
    setDeletingItemName('');
    setFeedback({ type: res.success ? 'success' : 'error', text: res.message });
    if (res.success) {
      addAdminAuditLog({
        admin_email: user?.email || 'admin',
        action: 'delete_item',
        target: `${deletedName} (ID: ${deletedId})`,
        details: 'Exclusão definitiva de anúncio com cascateamento no banco',
      });
      setItemsList((prev) => prev.filter((i) => i.iditem !== deletedId));
    }
  };

  // ─── Promoção de Administrador com Chave de Segurança ────────────────────────
  const PROMOTION_HASH = '80a3c5bc0549b3712207a64096f9c004169946b0b98536f0d23be90cfd9002c8';

  const hashPassword = async (text: string) => {
    const msgBuffer = new TextEncoder().encode(text.trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const handlePromoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promotingTarget) return;

    setAuthLoading(true);
    setAuthError(null);

    const enteredHash = await hashPassword(authPassword);
    const envSecret = process.env.REACT_APP_ADMIN_PROMOTION_SECRET?.trim();
    const isValid = enteredHash === PROMOTION_HASH || (Boolean(envSecret) && authPassword.trim() === envSecret);

    if (!isValid) {
      setAuthLoading(false);
      setAuthError('Senha incorreta');
      return;
    }

    const res = await promoteToAdmin({
      id: promotingTarget.id,
      auth_id: promotingTarget.auth_id,
      email: promotingTarget.email,
      fullName: promotingTarget.fullName,
    });

    setAuthLoading(false);
    const targetPromoted = promotingTarget;
    setPromotingTarget(null);
    setAuthPassword('');
    setFeedback({ type: res.success ? 'success' : 'error', text: res.message });
    if (res.success) {
      addAdminAuditLog({
        admin_email: user?.email || 'admin',
        action: 'promote_admin',
        target: `${targetPromoted.fullName} (${targetPromoted.email})`,
        details: 'Promoção a Administrador do sistema validada com chave mestra',
      });
    }
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
    const editedName = editingItem.nome;
    const editedId = editingItem.iditem;
    setEditingItem(null);
    setFeedback({ type: res.success ? 'success' : 'error', text: res.message });

    if (res.success) {
      addAdminAuditLog({
        admin_email: user?.email || 'admin',
        action: 'update_price',
        target: `${editedName} (ID: ${editedId})`,
        details: `Diária: R$ ${editPrices.diario}, Desconto: ${editPrices.desconto}%`,
      });
      setItemsList((prev) =>
        prev.map((i) =>
          i.iditem === editedId
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

  // ─── Moderação de Avaliações ─────────────────────────────────────────────────

  const handleConfirmDeleteReview = async () => {
    if (!deletingReviewId) return;
    setActionInProgress(true);
    const res = await deleteAvaliacao(deletingReviewId);
    setActionInProgress(false);
    const revId = deletingReviewId;
    setDeletingReviewId(null);
    setFeedback({ type: res.success ? 'success' : 'error', text: res.message });
    if (res.success) {
      addAdminAuditLog({
        admin_email: user?.email || 'admin',
        action: 'delete_review',
        target: `Avaliação #${revId}`,
        details: 'Exclusão de avaliação pela moderação administrativa',
      });
      setReviewsList((prev) => prev.filter((r) => r.idavaliacao !== revId));
    }
  };

  // ─── Limpar Logs de Auditoria ────────────────────────────────────────────────
  const handleClearLogs = () => {
    if (window.confirm('Tem certeza de que deseja limpar todos os logs de auditoria locais?')) {
      clearAdminAuditLogs();
      setAuditLogsList([]);
      setFeedback({ type: 'success', text: 'Logs de auditoria limpos com sucesso.' });
    }
  };

  // ─── Filtros de Listagem ─────────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    const q = searchItems.toLowerCase().trim();
    if (!q) return itemsList;
    return itemsList.filter(
      (item) =>
        item.nome.toLowerCase().includes(q) ||
        item.locador_name?.toLowerCase().includes(q) ||
        item.locador_email?.toLowerCase().includes(q)
    );
  }, [itemsList, searchItems]);

  const filteredUsers = useMemo(() => {
    const q = searchUsers.toLowerCase().trim();
    if (!q) return usersList;
    return usersList.filter(
      (u) =>
        u.fullName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.cpf?.toLowerCase().includes(q)
    );
  }, [usersList, searchUsers]);

  const filteredRentals = useMemo(() => {
    const q = searchRentals.toLowerCase().trim();
    if (!q) return rentalsList;
    return rentalsList.filter(
      (r) =>
        r.item_nome?.toLowerCase().includes(q) ||
        r.locador_nome?.toLowerCase().includes(q) ||
        r.locatario_nome?.toLowerCase().includes(q) ||
        r.status?.toLowerCase().includes(q)
    );
  }, [rentalsList, searchRentals]);

  const filteredReviews = useMemo(() => {
    const q = searchReviews.toLowerCase().trim();
    if (!q) return reviewsList;
    return reviewsList.filter(
      (rv) =>
        rv.comentario?.toLowerCase().includes(q) ||
        rv.avaliador_nome?.toLowerCase().includes(q) ||
        rv.avaliado_nome?.toLowerCase().includes(q)
    );
  }, [reviewsList, searchReviews]);

  const filteredLogs = useMemo(() => {
    const q = searchLogs.toLowerCase().trim();
    if (!q) return auditLogsList;
    return auditLogsList.filter(
      (lg) =>
        lg.admin_email?.toLowerCase().includes(q) ||
        lg.target?.toLowerCase().includes(q) ||
        lg.action?.toLowerCase().includes(q) ||
        lg.details?.toLowerCase().includes(q)
    );
  }, [auditLogsList, searchLogs]);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header Escuro com Estilo Premium */}
      <div className="bg-slate-900 text-white shadow-lg sticky top-0 z-30 border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={onGoBack}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center justify-center"
                title="Voltar"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-purple-600/30 text-purple-400">
                    <Shield size={18} />
                  </span>
                  <h1 className="text-lg font-bold tracking-tight">Painel de Administração</h1>
                </div>
                <p className="text-xs text-slate-400">
                  Gerenciamento de anúncios, usuários, transações, avaliações e auditoria
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
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setTab('items')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium text-xs whitespace-nowrap transition ${
                tab === 'items'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Package size={15} />
              <span>Anúncios ({itemsList.length})</span>
            </button>
            <button
              onClick={() => setTab('users')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium text-xs whitespace-nowrap transition ${
                tab === 'users'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Users size={15} />
              <span>Usuários ({usersList.length})</span>
            </button>
            <button
              onClick={() => setTab('rentals')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium text-xs whitespace-nowrap transition ${
                tab === 'rentals'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Repeat size={15} />
              <span>Aluguéis ({rentalsList.length})</span>
            </button>
            <button
              onClick={() => setTab('reviews')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium text-xs whitespace-nowrap transition ${
                tab === 'reviews'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Star size={15} />
              <span>Avaliações ({reviewsList.length})</span>
            </button>
            <button
              onClick={() => setTab('logs')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium text-xs whitespace-nowrap transition ${
                tab === 'logs'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <FileText size={15} />
              <span>Logs ({auditLogsList.length})</span>
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
            <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
              <Search size={18} className="text-gray-400 ml-2" />
              <input
                type="text"
                value={searchItems}
                onChange={(e) => setSearchItems(e.target.value)}
                placeholder="Buscar anúncios por título ou anunciante..."
                className="w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
              />
            </div>

            {loading ? (
              <div className="p-12 text-center text-gray-500">
                <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-600" />
                Carregando catálogo de anúncios...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-gray-200">
                <Package size={40} className="mx-auto text-gray-300 mb-2" />
                <p className="font-semibold text-gray-600">Nenhum anúncio encontrado.</p>
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

                      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                        <button
                          onClick={() => handleOpenPriceModal(item)}
                          className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold flex items-center gap-1.5 transition"
                        >
                          <Edit3 size={14} />
                          <span>Preços & Desconto</span>
                        </button>

                        <button
                          onClick={() => handleOpenDeleteModal(item)}
                          className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold flex items-center gap-1.5 transition border border-red-200"
                        >
                          <Trash2 size={14} />
                          <span>Excluir Anúncio</span>
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
            <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
              <Search size={18} className="text-gray-400 ml-2" />
              <input
                type="text"
                value={searchUsers}
                onChange={(e) => setSearchUsers(e.target.value)}
                placeholder="Buscar por nome, e-mail ou CPF..."
                className="w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
              />
            </div>

            {loading ? (
              <div className="p-12 text-center text-gray-500">
                <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-600" />
                Carregando lista de usuários...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-gray-200">
                <Users size={40} className="mx-auto text-gray-300 mb-2" />
                <p className="font-semibold text-gray-600">Nenhum usuário encontrado.</p>
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
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 overflow-hidden flex-shrink-0">
                            {u.avatar_url ? (
                              <img
                                src={u.avatar_url}
                                alt={u.fullName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>{(u.fullName || 'U').charAt(0).toUpperCase()}</span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-gray-900 text-sm">{u.fullName}</h4>
                              {isTargetAdmin && (
                                <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-purple-200">
                                  <Shield size={10} /> Admin
                                </span>
                              )}
                              {isBanned && (
                                <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-red-200">
                                  <ShieldAlert size={10} /> Banido
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate">{u.email}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              {u.cidade ? `${u.cidade}/${u.estado || ''} • ` : ''}
                              {u.item_count || 0} anúncio(s) ativo(s)
                            </p>
                          </div>
                        </div>

                        {/* Ações para o usuário */}
                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
                          {/* Chat direto com o usuário */}
                          <button
                            onClick={() => onGoToChatWithUser?.(u.id, u.fullName)}
                            className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold flex items-center gap-1.5 transition border border-blue-200"
                            title="Abrir chat direto com o usuário"
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

                          {/* Banir / Desbanir */}
                          {isTargetAdmin ? (
                            <span
                              className="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-400 text-xs font-medium cursor-not-allowed flex items-center gap-1.5"
                              title="Administradores não podem ser banidos"
                            >
                              <Shield size={14} />
                              <span>Admin Protegido</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleBanToggle(u)}
                              disabled={actionInProgress}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                                isBanned
                                  ? 'bg-green-50 hover:bg-green-100 text-green-700 border border-green-200'
                                  : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {isBanned ? (
                                <>
                                  <UserCheck size={14} />
                                  <span>Desbanir</span>
                                </>
                              ) : (
                                <>
                                  <UserX size={14} />
                                  <span>Banir Usuário</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* Excluir Conta Definitivamente (apenas não-admins) */}
                          {!isTargetAdmin && (
                            <button
                              onClick={() => setDeletingUserTarget(u)}
                              className="p-1.5 rounded-xl text-red-500 hover:bg-red-50 transition border border-transparent hover:border-red-200"
                              title="Excluir conta definitivamente"
                            >
                              <Trash2 size={16} />
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

        {/* ─── ABA 3: MONITORAR ALUGUÉIS EM TRANSAÇÃO ───────────────────────── */}
        {tab === 'rentals' && (
          <div className="space-y-4">
            <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
              <Search size={18} className="text-gray-400 ml-2" />
              <input
                type="text"
                value={searchRentals}
                onChange={(e) => setSearchRentals(e.target.value)}
                placeholder="Buscar por item, locador, locatário ou status..."
                className="w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
              />
            </div>

            {loading ? (
              <div className="p-12 text-center text-gray-500">
                <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-600" />
                Carregando transações e solicitações...
              </div>
            ) : filteredRentals.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-gray-200">
                <Repeat size={40} className="mx-auto text-gray-300 mb-2" />
                <p className="font-semibold text-gray-600">Nenhum aluguel encontrado.</p>
                <p className="text-xs text-gray-400 mt-1">Nenhuma solicitação ou transação registrada.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredRentals.map((r) => (
                  <div
                    key={r.idsolicitacao}
                    className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                            <Repeat size={18} />
                          </span>
                          <div>
                            <h4 className="font-bold text-gray-900 text-sm">{r.item_nome}</h4>
                            <p className="text-[11px] text-gray-400">Solicitação #{r.idsolicitacao}</p>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                            r.status === 'aceito' || r.status === 'em_andamento'
                              ? 'bg-blue-100 text-blue-700 border border-blue-200'
                              : r.status === 'concluido' || r.status === 'finalizado'
                              ? 'bg-green-100 text-green-700 border border-green-200'
                              : r.status === 'recusado' || r.status === 'cancelado'
                              ? 'bg-red-100 text-red-700 border border-red-200'
                              : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase">Locador</p>
                          <p className="font-bold text-gray-800 truncate">{r.locador_nome}</p>
                          <p className="text-[11px] text-gray-500 truncate">{r.locador_email}</p>
                        </div>
                        <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase">Locatário</p>
                          <p className="font-bold text-gray-800 truncate">{r.locatario_nome}</p>
                          <p className="text-[11px] text-gray-500 truncate">{r.locatario_email}</p>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-gray-500">
                          <Calendar size={13} />
                          <span>
                            {r.data_inicio ? `${r.data_inicio} até ${r.data_fim}` : 'Período não definido'}
                          </span>
                        </div>
                        <div className="font-bold text-blue-700 text-sm">
                          {fmtBRL(r.valor_total)}
                        </div>
                      </div>

                      {(r.status_pagamento || r.status_devolucao) && (
                        <div className="mt-2 flex gap-2 text-[10px]">
                          {r.status_pagamento && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                              Pagamento: {r.status_pagamento}
                            </span>
                          )}
                          {r.status_devolucao && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                              Devolução: {r.status_devolucao}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── ABA 4: MODERAÇÃO DE AVALIAÇÕES ───────────────────────────────── */}
        {tab === 'reviews' && (
          <div className="space-y-4">
            <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
              <Search size={18} className="text-gray-400 ml-2" />
              <input
                type="text"
                value={searchReviews}
                onChange={(e) => setSearchReviews(e.target.value)}
                placeholder="Buscar avaliações por comentário, avaliador ou avaliado..."
                className="w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
              />
            </div>

            {loading ? (
              <div className="p-12 text-center text-gray-500">
                <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-600" />
                Carregando avaliações...
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-gray-200">
                <Star size={40} className="mx-auto text-gray-300 mb-2" />
                <p className="font-semibold text-gray-600">Nenhuma avaliação encontrada.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReviews.map((rev) => (
                  <div
                    key={rev.idavaliacao}
                    className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex text-amber-400">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              size={14}
                              className={
                                i < Math.round(rev.nota / 2)
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-gray-300'
                              }
                            />
                          ))}
                        </div>
                        <span className="text-xs font-bold text-gray-800">
                          {rev.nota} / 10
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">
                          De: <strong className="text-gray-700">{rev.avaliador_nome}</strong> para:{' '}
                          <strong className="text-gray-700">{rev.avaliado_nome}</strong>
                        </span>
                      </div>

                      <p className="text-sm text-gray-700 italic bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                        "{rev.comentario || 'Sem comentário de texto.'}"
                      </p>

                      <p className="text-[11px] text-gray-400 mt-1">
                        Data: {rev.data_avaliacao ? new Date(rev.data_avaliacao).toLocaleDateString('pt-BR') : '-'}
                      </p>
                    </div>

                    <button
                      onClick={() => setDeletingReviewId(rev.idavaliacao)}
                      className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold flex items-center gap-1.5 transition border border-red-200 self-end sm:self-center"
                    >
                      <Trash2 size={14} />
                      <span>Excluir Avaliação</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── ABA 5: LOG DE AÇÕES DA FERRAMENTA (AUDITORIA) ─────────────────── */}
        {tab === 'logs' && (
          <div className="space-y-4">
            <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1">
                <Search size={18} className="text-gray-400 ml-2" />
                <input
                  type="text"
                  value={searchLogs}
                  onChange={(e) => setSearchLogs(e.target.value)}
                  placeholder="Buscar nos logs por admin, ação ou alvo..."
                  className="w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
                />
              </div>

              {auditLogsList.length > 0 && (
                <button
                  onClick={handleClearLogs}
                  className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold transition"
                >
                  Limpar Logs
                </button>
              )}
            </div>

            {filteredLogs.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-gray-200">
                <FileText size={40} className="mx-auto text-gray-300 mb-2" />
                <p className="font-semibold text-gray-600">Nenhum log de auditoria registrado ainda.</p>
                <p className="text-xs text-gray-400 mt-1">
                  Ações como exclusão de anúncios, banimentos e promoções aparecerão aqui automaticamente.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="divide-y divide-gray-100">
                  {filteredLogs.map((log) => {
                    const actionBadge = (() => {
                      switch (log.action) {
                        case 'delete_item':
                          return <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Excluiu Anúncio</span>;
                        case 'delete_user':
                          return <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Excluiu Usuário</span>;
                        case 'ban_user':
                          return <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Baniu Usuário</span>;
                        case 'unban_user':
                          return <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Desbaniu Usuário</span>;
                        case 'promote_admin':
                          return <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Promoveu Admin</span>;
                        case 'demote_admin':
                          return <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Revogou Admin</span>;
                        case 'update_price':
                          return <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Alterou Preço</span>;
                        case 'delete_review':
                          return <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Excluiu Avaliação</span>;
                        default:
                          return <span className="bg-gray-100 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Ação</span>;
                      }
                    })();

                    return (
                      <div key={log.id} className="p-4 hover:bg-gray-50/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            {actionBadge}
                            <span className="text-xs font-bold text-gray-900">{log.target}</span>
                          </div>
                          <p className="text-xs text-gray-600">{log.details}</p>
                          <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                            <span>Executado por: <strong className="text-gray-600">{log.admin_email}</strong></span>
                          </p>
                        </div>
                        <div className="text-[11px] text-gray-400 whitespace-nowrap self-end sm:self-center">
                          {new Date(log.timestamp).toLocaleString('pt-BR')}
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

      {/* ─── MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE ANÚNCIO ─────────────────────── */}
      {deletingItemId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 size={24} />
            </div>
            <h3 className="font-bold text-gray-900 text-base text-center">
              Excluir Anúncio Permanentemente?
            </h3>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Você está prestes a remover o anúncio <strong>"{deletingItemName}"</strong>. Todas as fotos e mensagens associadas serão excluídas do banco de dados.
            </p>
            <div className="flex gap-2 mt-6">
              <button
                type="button"
                disabled={actionInProgress}
                onClick={() => setDeletingItemId(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={actionInProgress}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                {actionInProgress ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  'Excluir'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE CONTA DE USUÁRIO ───────────── */}
      {deletingUserTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <UserX size={24} />
            </div>
            <h3 className="font-bold text-gray-900 text-base text-center">
              Excluir Conta Definitivamente?
            </h3>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Você está prestes a excluir a conta de <strong>"{deletingUserTarget.fullName}"</strong> ({deletingUserTarget.email}).
            </p>
            <p className="text-[11px] text-red-700 bg-red-50 p-2.5 rounded-xl border border-red-200 mt-3 text-center">
              Esta ação removerá todos os anúncios, fotos, mensagens e transações do usuário sem volta.
            </p>
            <div className="flex gap-2 mt-6">
              <button
                type="button"
                disabled={actionInProgress}
                onClick={() => setDeletingUserTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={actionInProgress}
                onClick={handleConfirmDeleteUser}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                {actionInProgress ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  'Confirmar Exclusão'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE AVALIAÇÃO ──────────────────── */}
      {deletingReviewId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Star size={24} />
            </div>
            <h3 className="font-bold text-gray-900 text-base text-center">
              Excluir Avaliação?
            </h3>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Tem certeza que deseja remover esta avaliação? Ela deixará de constar no perfil do usuário avaliado.
            </p>
            <div className="flex gap-2 mt-6">
              <button
                type="button"
                disabled={actionInProgress}
                onClick={() => setDeletingReviewId(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={actionInProgress}
                onClick={handleConfirmDeleteReview}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                {actionInProgress ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  'Excluir'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL DE EDIÇÃO DE PREÇOS E DESCONTO ───────────────────────────── */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-blue-600 font-bold text-sm">
                <Tag size={18} />
                <span>Gestão Forçada de Preços</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-gray-400 hover:text-gray-600 text-base"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-3">
              Item: <strong>{editingItem.nome}</strong>
            </p>

            <form onSubmit={handleSavePrices} className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Aluguel Diário (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={editPrices.diario}
                  onChange={(e) =>
                    setEditPrices({ ...editPrices, diario: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Semanal (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editPrices.semana}
                    onChange={(e) =>
                      setEditPrices({ ...editPrices, semana: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Mensal (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editPrices.mensal}
                    onChange={(e) =>
                      setEditPrices({ ...editPrices, mensal: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Desconto Percentual Promocional (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={editPrices.desconto}
                    onChange={(e) =>
                      setEditPrices({
                        ...editPrices,
                        desconto: Math.min(99, Math.max(0, parseInt(e.target.value) || 0)),
                      })
                    }
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-500 font-bold">%</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  0 = sem desconto. O valor é salvo no campo <code>desconto_percentual</code>.
                </p>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPrices}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {savingPrices ? <RefreshCw size={14} className="animate-spin" /> : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL DE PROMOÇÃO DE ADMINISTRADOR COM CHAVE DE SEGURANÇA ───────── */}
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
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {authLoading ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    'Confirmar e Promover'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
