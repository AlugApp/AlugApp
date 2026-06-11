import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { censurarTexto } from '../lib/censura';
import { ArrowLeft, Send, CheckCircle, XCircle, MessageSquare, Clock, Camera } from 'lucide-react';

interface Solicitacao {
  idsolicitacao: number;
  iditem: number;
  idlocador: number;
  idlocatario: number;
  data_inicio_prevista: string;
  data_fim_prevista: string;
  valor_total_previsto: number;
  status: string;
  foto_antes_url?: string | null;
  foto_recebimento_url?: string | null;
  item?: { nome: string; foto_url?: string };
  locador_user?: { fullName: string; avatar_url?: string };
  locatario_user?: { fullName: string; avatar_url?: string };
}

interface Mensagem {
  idmensagem: number;
  idsolicitacao: number;
  idremetente: number;
  conteudo: string;
  criado_em: string;
}

interface ConversaGroup {
  otherId: number;
  otherUser: { fullName: string; avatar_url?: string } | null;
  solicitacoes: Solicitacao[];
  needsAction: boolean;
  myRole: 'locador' | 'locatario';
}

interface ConversaAberta {
  otherId: number;
  otherUser: { fullName: string; avatar_url?: string } | null;
  myRole: 'locador' | 'locatario';
  solicitacoes: Solicitacao[];
}

interface ChatProps {
  onGoBack: () => void;
  onGoToPerfil: () => void;
  onGoToMyAnnouncements: () => void;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  pendente:           { label: 'Pendente',     color: 'text-yellow-700', bg: 'bg-yellow-50'  },
  aprovado:           { label: 'Aprovado',     color: 'text-blue-700',   bg: 'bg-blue-50'    },
  aguardando_entrega: { label: 'Ag. Entrega',  color: 'text-orange-600', bg: 'bg-orange-50'  },
  em_andamento:       { label: 'Em Andamento', color: 'text-indigo-600', bg: 'bg-indigo-50'  },
  rejeitado:          { label: 'Rejeitado',    color: 'text-red-600',    bg: 'bg-red-50'     },
  cancelado:          { label: 'Cancelado',    color: 'text-gray-500',   bg: 'bg-gray-100'   },
  concluido:          { label: 'Concluído',    color: 'text-green-700',  bg: 'bg-green-50'   },
};

const CHAT_ATIVO_STATUS = new Set(['pendente', 'aprovado', 'aguardando_entrega', 'em_andamento']);
const TERMINAL_STATUS   = new Set(['concluido', 'cancelado', 'rejeitado']);

function groupByOther(
  sols: Solicitacao[],
  myRole: 'locador' | 'locatario'
): ConversaGroup[] {
  const map = new Map<number, Solicitacao[]>();
  for (const sol of sols) {
    const otherId = myRole === 'locador' ? sol.idlocatario : sol.idlocador;
    if (!map.has(otherId)) map.set(otherId, []);
    map.get(otherId)!.push(sol);
  }
  return Array.from(map.entries())
    .map(([otherId, group]) => {
      const sorted = [...group].sort((a, b) => b.idsolicitacao - a.idsolicitacao);
      const newest = sorted[0];
      const otherUser = (myRole === 'locador' ? newest.locatario_user : newest.locador_user) ?? null;
      const needsAction = myRole === 'locador'
        ? group.some(s => s.status === 'pendente' || s.status === 'aprovado')
        : group.some(s => s.status === 'aguardando_entrega');
      return { otherId, otherUser, solicitacoes: sorted, needsAction, myRole };
    })
    .sort((a, b) => b.solicitacoes[0].idsolicitacao - a.solicitacoes[0].idsolicitacao);
}

export default function Chat({ onGoBack, onGoToPerfil, onGoToMyAnnouncements }: ChatProps) {
  const { profile } = useAuth();

  const [solicitacoes, setSolicitacoes]   = useState<Solicitacao[]>([]);
  const [loading, setLoading]             = useState(true);
  const [queryError, setQueryError]       = useState<string | null>(null);
  const [activeTab, setActiveTab]         = useState<'pedidos' | 'requisicoes'>('pedidos');
  const [selectedConversa, setSelectedConversa] = useState<ConversaAberta | null>(null);
  const [responding, setResponding]       = useState<number | null>(null);

  const [mensagens, setMensagens]         = useState<Mensagem[]>([]);
  const [msgInput, setMsgInput]           = useState('');
  const [sendingMsg, setSendingMsg]       = useState(false);
  const messagesEndRef                    = useRef<HTMLDivElement>(null);

  const [showFotoModal, setShowFotoModal]     = useState(false);
  const [fotoModalMode, setFotoModalMode]     = useState<'antes' | 'recebimento' | null>(null);
  const [fotoFile, setFotoFile]               = useState<File | null>(null);
  const [fotoPreview, setFotoPreview]         = useState<string | null>(null);
  const [uploadingFoto, setUploadingFoto]     = useState(false);
  const [fotoError, setFotoError]             = useState<string | null>(null);
  const [activeSolForFoto, setActiveSolForFoto] = useState<number | null>(null);

  // ── Carregar todas as solicitações ─────────────────────────────────────────
  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);

    const { data: solData, error } = await supabase
      .from('solicitacao_aluguel')
      .select('*')
      .or(`idlocador.eq.${profile.id},idlocatario.eq.${profile.id}`)
      .order('idsolicitacao', { ascending: false });

    if (error) { setQueryError(error.message); setLoading(false); return; }
    if (!solData || solData.length === 0) { setSolicitacoes([]); setLoading(false); return; }

    const itemIds = Array.from(new Set(solData.map((s: any) => s.iditem)));
    const userIds = Array.from(new Set([
      ...solData.map((s: any) => s.idlocador),
      ...solData.map((s: any) => s.idlocatario),
    ]));

    const [itemsRes, usersRes, fotosRes] = await Promise.all([
      supabase.from('item').select('iditem, nome').in('iditem', itemIds),
      supabase.from('users').select('id, fullName, avatar_url').in('id', userIds),
      supabase.from('fotoitem').select('iditem, url_foto').in('iditem', itemIds),
    ]);

    const merged: Solicitacao[] = solData.map((s: any) => ({
      ...s,
      item: {
        nome: itemsRes.data?.find((i: any) => i.iditem === s.iditem)?.nome ?? '—',
        foto_url: fotosRes.data?.find((f: any) => f.iditem === s.iditem)?.url_foto,
      },
      locador_user:   usersRes.data?.find((u: any) => u.id === s.idlocador)   ?? null,
      locatario_user: usersRes.data?.find((u: any) => u.id === s.idlocatario) ?? null,
    }));

    setSolicitacoes(merged);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);

  // Sincroniza solicitacoes da conversa aberta quando o estado global muda
  useEffect(() => {
    if (!selectedConversa || !profile?.id) return;
    const { myRole, otherId } = selectedConversa;
    const filtered = solicitacoes.filter(s =>
      myRole === 'locador'
        ? s.idlocador === profile.id && s.idlocatario === otherId
        : s.idlocatario === profile.id && s.idlocador === otherId
    );
    const sorted = [...filtered].sort((a, b) => a.idsolicitacao - b.idsolicitacao);
    setSelectedConversa(prev => prev ? { ...prev, solicitacoes: sorted } : null);
  }, [solicitacoes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mensagens + Realtime ao abrir conversa ─────────────────────────────────
  useEffect(() => {
    if (!selectedConversa) { setMensagens([]); return; }
    const solIds = selectedConversa.solicitacoes.map(s => s.idsolicitacao);
    if (solIds.length === 0) return;

    supabase.from('mensagem')
      .select('*')
      .in('idsolicitacao', solIds)
      .order('criado_em', { ascending: true })
      .then(({ data }) => setMensagens((data as Mensagem[]) || []));

    const channels = solIds.map(solId =>
      supabase.channel(`chat-sol-${solId}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'mensagem', filter: `idsolicitacao=eq.${solId}` },
          (payload) => {
            setMensagens(prev => {
              const nova = payload.new as Mensagem;
              if (prev.some(m => m.idmensagem === nova.idmensagem)) return prev;
              return [...prev, nova];
            });
          }
        ).subscribe()
    );

    return () => { channels.forEach(ch => supabase.removeChannel(ch)); };
  }, [selectedConversa?.otherId, selectedConversa?.myRole]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  // ── Agrupamentos por aba ────────────────────────────────────────────────────
  const pedidos = useMemo(() =>
    groupByOther(solicitacoes.filter(s => s.idlocador === profile?.id), 'locador'),
    [solicitacoes, profile?.id]
  );

  const requisicoes = useMemo(() =>
    groupByOther(solicitacoes.filter(s => s.idlocatario === profile?.id), 'locatario'),
    [solicitacoes, profile?.id]
  );

  const openConversa = (group: ConversaGroup) => {
    const sorted = [...group.solicitacoes].sort((a, b) => a.idsolicitacao - b.idsolicitacao);
    setSelectedConversa({ otherId: group.otherId, otherUser: group.otherUser, myRole: group.myRole, solicitacoes: sorted });
    setMsgInput('');
  };

  // ── Ações de status ─────────────────────────────────────────────────────────
  const applyStatus = (id: number, novoStatus: string, extra?: Partial<Solicitacao>) => {
    setSolicitacoes(prev =>
      prev.map(s => s.idsolicitacao === id ? { ...s, status: novoStatus, ...extra } : s)
    );
  };

  const handleResponder = async (id: number, novoStatus: 'aprovado' | 'rejeitado') => {
    if (responding !== null) return;
    setResponding(id);
    const { error } = await supabase.from('solicitacao_aluguel')
      .update({ status: novoStatus }).eq('idsolicitacao', id).eq('status', 'pendente');
    if (!error) applyStatus(id, novoStatus);
    setResponding(null);
  };

  const handleCancelar = async (id: number) => {
    if (responding !== null) return;
    setResponding(id);
    const { error } = await supabase.from('solicitacao_aluguel')
      .update({ status: 'cancelado' }).eq('idsolicitacao', id).eq('status', 'pendente');
    if (!error) applyStatus(id, 'cancelado');
    setResponding(null);
  };

  const handleDevolver = async (id: number) => {
    if (responding !== null) return;
    setResponding(id);
    const { error } = await supabase.from('solicitacao_aluguel')
      .update({ status: 'concluido' }).eq('idsolicitacao', id);
    if (!error) applyStatus(id, 'concluido');
    setResponding(null);
  };

  // ── Modal de foto ───────────────────────────────────────────────────────────
  const openFotoModal = (mode: 'antes' | 'recebimento', solId: number) => {
    setFotoModalMode(mode); setActiveSolForFoto(solId);
    setFotoFile(null); setFotoPreview(null); setFotoError(null); setShowFotoModal(true);
  };
  const closeFotoModal = () => {
    setShowFotoModal(false); setFotoFile(null);
    setFotoPreview(null); setFotoError(null); setActiveSolForFoto(null);
  };
  const handleFotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoFile(file); setFotoPreview(URL.createObjectURL(file)); e.target.value = '';
  };
  const handleFotoSubmit = async () => {
    if (!fotoFile || !fotoModalMode || activeSolForFoto === null) return;
    setUploadingFoto(true); setFotoError(null);

    const suffix = fotoModalMode === 'antes' ? 'antes' : 'recebimento';
    const fileName = `rental/${activeSolForFoto}-${suffix}-${Date.now()}`;
    const { error: uploadError } = await supabase.storage.from('items').upload(fileName, fotoFile);
    if (uploadError) { setFotoError('Erro ao enviar a foto. Tente novamente.'); setUploadingFoto(false); return; }

    const { data: { publicUrl } } = supabase.storage.from('items').getPublicUrl(fileName);

    if (fotoModalMode === 'antes') {
      const { error } = await supabase.from('solicitacao_aluguel')
        .update({ foto_antes_url: publicUrl, status: 'aguardando_entrega' })
        .eq('idsolicitacao', activeSolForFoto);
      if (!error) { applyStatus(activeSolForFoto, 'aguardando_entrega', { foto_antes_url: publicUrl }); closeFotoModal(); }
      else setFotoError('Erro ao registrar foto.');
    } else {
      const { error } = await supabase.from('solicitacao_aluguel')
        .update({ foto_recebimento_url: publicUrl, status: 'em_andamento' })
        .eq('idsolicitacao', activeSolForFoto);
      if (!error) { applyStatus(activeSolForFoto, 'em_andamento', { foto_recebimento_url: publicUrl }); closeFotoModal(); }
      else setFotoError('Erro ao confirmar recebimento.');
    }
    setUploadingFoto(false);
  };

  // ── Enviar mensagem ─────────────────────────────────────────────────────────
  const handleSend = async () => {
    const texto = msgInput.trim();
    if (!texto || !selectedConversa || !profile?.id || sendingMsg) return;

    // Envia para a solicitação ativa mais recente
    const solsDesc = [...selectedConversa.solicitacoes].sort((a, b) => b.idsolicitacao - a.idsolicitacao);
    const targetSol = solsDesc.find(s => CHAT_ATIVO_STATUS.has(s.status)) ?? solsDesc[0];

    const textoCensurado = censurarTexto(texto);
    setSendingMsg(true);
    setMsgInput('');

    const { data: novaMsg } = await supabase
      .from('mensagem')
      .insert({ idsolicitacao: targetSol.idsolicitacao, idremetente: profile.id, conteudo: textoCensurado })
      .select().single();

    if (novaMsg) {
      setMensagens(prev => {
        if (prev.some(m => m.idmensagem === novaMsg.idmensagem)) return prev;
        return [...prev, novaMsg as Mensagem];
      });
    }
    setSendingMsg(false);
  };

  /* ══════════════════════════════════════════════════════════════════════════
     Tela de detalhe da conversa
  ══════════════════════════════════════════════════════════════════════════ */
  if (selectedConversa) {
    const { otherUser, myRole, solicitacoes: convSols } = selectedConversa;
    const chatAtivo = convSols.some(s => CHAT_ATIVO_STATUS.has(s.status));

    return (
      <div className="fixed top-0 left-0 right-0 bottom-16 bg-gray-50 flex flex-col">

        {/* Header */}
        <header className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSelectedConversa(null)} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden flex-shrink-0">
            {otherUser?.avatar_url
              ? <img src={otherUser.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              : <span className="text-blue-600 font-bold text-base">{otherUser?.fullName?.charAt(0) || '?'}</span>
            }
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-gray-900">{otherUser?.fullName || 'Usuário'}</h2>
            <p className="text-xs text-gray-500">
              {myRole === 'locador' ? 'Locatário' : 'Locador'} · {convSols.length} {convSols.length === 1 ? 'aluguel' : 'aluguéis'}
            </p>
          </div>
        </header>

        {/* Área de scroll */}
        <div className="flex-1 overflow-y-auto">

          {/* Cards de cada solicitação (mais antigos no topo) */}
          <div className="p-4 space-y-3">
            {convSols.map(sol => {
              const isLocador   = myRole === 'locador';
              const isResponding = responding === sol.idsolicitacao;
              const st = STATUS_LABEL[sol.status] ?? { label: sol.status, color: 'text-gray-500', bg: 'bg-gray-100' };
              const isTerminal = TERMINAL_STATUS.has(sol.status);

              return (
                <div key={sol.idsolicitacao} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

                  {/* Cabeçalho do card */}
                  <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                    <div className="w-12 h-12 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden">
                      {sol.item?.foto_url && (
                        <img src={sol.item.foto_url} alt="Item" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{sol.item?.nome}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {fmtDate(sol.data_inicio_prevista)} → {fmtDate(sol.data_fim_prevista)}
                      </p>
                      <p className="text-sm font-bold text-blue-700 mt-0.5">{fmtBRL(sol.valor_total_previsto)}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${st.color} ${st.bg}`}>
                      {st.label}
                    </span>
                  </div>

                  {/* Ações (somente para status não terminais) */}
                  {!isTerminal && (
                    <div className="px-4 pb-4 space-y-2">

                      {/* PENDENTE */}
                      {sol.status === 'pendente' && isLocador && (
                        <div className="flex gap-2">
                          <button onClick={() => handleResponder(sol.idsolicitacao, 'rejeitado')} disabled={isResponding}
                            className="flex-1 py-2 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition disabled:opacity-50">
                            {isResponding ? '...' : 'Rejeitar'}
                          </button>
                          <button onClick={() => handleResponder(sol.idsolicitacao, 'aprovado')} disabled={isResponding}
                            className="flex-1 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50">
                            {isResponding ? '...' : 'Aceitar'}
                          </button>
                        </div>
                      )}
                      {sol.status === 'pendente' && !isLocador && (
                        <div className="space-y-2">
                          <p className="text-xs text-yellow-600 font-medium text-center bg-yellow-50 py-1.5 rounded-lg flex items-center justify-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> Aguardando resposta do locador...
                          </p>
                          <button onClick={() => handleCancelar(sol.idsolicitacao)} disabled={isResponding}
                            className="w-full py-1.5 text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition disabled:opacity-50">
                            {isResponding ? 'Cancelando...' : 'Cancelar Solicitação'}
                          </button>
                        </div>
                      )}

                      {/* APROVADO */}
                      {sol.status === 'aprovado' && isLocador && (
                        <div className="space-y-2">
                          <p className="text-xs text-blue-700 font-medium bg-blue-50 py-2 px-3 rounded-lg flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            Aprovado! Registre o estado atual do item antes da entrega.
                          </p>
                          <button onClick={() => openFotoModal('antes', sol.idsolicitacao)}
                            className="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition flex items-center justify-center gap-2">
                            <Camera className="w-4 h-4" /> Fotografar Estado do Item
                          </button>
                        </div>
                      )}
                      {sol.status === 'aprovado' && !isLocador && (
                        <p className="text-xs text-green-700 font-medium flex items-center justify-center gap-1.5 bg-green-50 py-2 px-3 rounded-lg">
                          <CheckCircle className="w-4 h-4" /> Aprovado! Aguardando o locador registrar o estado do item.
                        </p>
                      )}

                      {/* AGUARDANDO ENTREGA */}
                      {sol.status === 'aguardando_entrega' && isLocador && (
                        <div className="space-y-2">
                          {sol.foto_antes_url && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1.5 font-medium">Estado registrado:</p>
                              <img src={sol.foto_antes_url} alt="Estado antes" className="w-full h-36 object-cover rounded-xl" />
                            </div>
                          )}
                          <p className="text-xs text-yellow-700 font-medium bg-yellow-50 py-2 px-3 rounded-lg flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 flex-shrink-0" /> Aguardando o locatário confirmar o recebimento.
                          </p>
                        </div>
                      )}
                      {sol.status === 'aguardando_entrega' && !isLocador && (
                        <div className="space-y-2">
                          {sol.foto_antes_url && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1.5 font-medium">Estado antes da entrega:</p>
                              <img src={sol.foto_antes_url} alt="Estado antes" className="w-full h-36 object-cover rounded-xl" />
                            </div>
                          )}
                          <p className="text-xs text-blue-700 font-medium bg-blue-50 py-2 px-3 rounded-lg">
                            O locador preparou o item. Confirme o recebimento com uma foto.
                          </p>
                          <button onClick={() => openFotoModal('recebimento', sol.idsolicitacao)}
                            className="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition flex items-center justify-center gap-2">
                            <Camera className="w-4 h-4" /> Confirmar Recebimento
                          </button>
                        </div>
                      )}

                      {/* EM ANDAMENTO */}
                      {sol.status === 'em_andamento' && isLocador && (
                        <div className="space-y-2">
                          {sol.foto_antes_url && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1.5 font-medium">Estado antes da entrega:</p>
                              <img src={sol.foto_antes_url} alt="Estado antes" className="w-full h-28 object-cover rounded-xl" />
                            </div>
                          )}
                          {sol.foto_recebimento_url && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1.5 font-medium">Confirmação do locatário:</p>
                              <img src={sol.foto_recebimento_url} alt="Confirmação" className="w-full h-28 object-cover rounded-xl" />
                            </div>
                          )}
                          <p className="text-xs text-indigo-700 font-medium bg-indigo-50 py-2 px-3 rounded-lg">
                            Item em uso. Devolução prevista para {fmtDate(sol.data_fim_prevista)}.
                          </p>
                        </div>
                      )}
                      {sol.status === 'em_andamento' && !isLocador && (
                        <div className="space-y-2">
                          {sol.foto_antes_url && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1.5 font-medium">Estado antes da entrega:</p>
                              <img src={sol.foto_antes_url} alt="Estado antes" className="w-full h-28 object-cover rounded-xl" />
                            </div>
                          )}
                          <p className="text-xs text-indigo-700 font-medium bg-indigo-50 py-2 px-3 rounded-lg">
                            Item em uso. Devolução prevista para {fmtDate(sol.data_fim_prevista)}.
                          </p>
                          <button onClick={() => handleDevolver(sol.idsolicitacao)} disabled={isResponding}
                            className="w-full py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2">
                            {isResponding ? 'Processando...' : '↩ Devolver Item'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Separador de mensagens */}
          <div className="flex items-center px-4 py-1 gap-2">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[10px] text-gray-400 font-medium tracking-wide uppercase">mensagens</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Balões de mensagens */}
          <div className="px-4 py-3 space-y-2">
            {mensagens.length === 0 && (
              <p className="text-center text-xs text-gray-400 py-4">
                {chatAtivo ? 'Nenhuma mensagem ainda. Diga olá!' : 'Sem mensagens nesta conversa.'}
              </p>
            )}
            {mensagens.map(msg => {
              const isOwn = msg.idremetente === profile?.id;
              return (
                <div key={msg.idmensagem} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl shadow-sm ${
                    isOwn
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                  }`}>
                    <p className="text-sm leading-snug break-words">{msg.conteudo}</p>
                    <p className={`text-[10px] mt-0.5 text-right ${isOwn ? 'text-blue-200' : 'text-gray-400'}`}>
                      {fmtTime(msg.criado_em)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Barra de input */}
        <div className="flex-shrink-0 bg-white border-t border-gray-200 px-3 py-2.5 flex gap-2 items-center">
          <input
            type="text"
            placeholder={chatAtivo ? 'Digite uma mensagem...' : 'Sem aluguel ativo'}
            disabled={!chatAtivo || sendingMsg}
            value={msgInput}
            onChange={e => setMsgInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none disabled:opacity-40 focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={handleSend}
            disabled={!chatAtivo || !msgInput.trim() || sendingMsg}
            className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white disabled:opacity-40 transition hover:bg-blue-700 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Modal de upload de foto */}
        {showFotoModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl">
              <h3 className="font-bold text-lg text-gray-900 mb-1">
                {fotoModalMode === 'antes' ? 'Estado do Item' : 'Confirmar Recebimento'}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {fotoModalMode === 'antes'
                  ? 'Fotografe o item para registrar seu estado antes da entrega.'
                  : 'Fotografe o item recebido para confirmar a entrega.'}
              </p>
              {fotoPreview ? (
                <div className="relative mb-4">
                  <img src={fotoPreview} alt="Preview" className="w-full h-52 object-cover rounded-xl" />
                  <button onClick={() => { setFotoFile(null); setFotoPreview(null); }}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shadow">
                    ✕
                  </button>
                </div>
              ) : (
                <label className="flex w-full h-44 border-2 border-dashed border-gray-200 rounded-xl flex-col items-center justify-center cursor-pointer hover:border-blue-400 mb-4 transition">
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoSelect} />
                  <Camera className="w-10 h-10 text-gray-300 mb-2" />
                  <span className="text-sm text-gray-400">Toque para tirar ou escolher foto</span>
                </label>
              )}
              {fotoError && <p className="text-xs text-red-600 mb-3 text-center">{fotoError}</p>}
              <div className="flex gap-3">
                <button onClick={closeFotoModal} disabled={uploadingFoto}
                  className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium">
                  Cancelar
                </button>
                <button onClick={handleFotoSubmit} disabled={!fotoFile || uploadingFoto}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-50 transition">
                  {uploadingFoto ? 'Enviando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════════
     Lista de conversas
  ══════════════════════════════════════════════════════════════════════════ */
  const currentList    = activeTab === 'pedidos' ? pedidos : requisicoes;
  const pedidosBadge   = pedidos.filter(c => c.needsAction).length;
  const reqBadge       = requisicoes.filter(c => c.needsAction).length;

  return (
    <div className="min-h-screen bg-white pb-20">
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">Chat</h1>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 sticky top-[65px] z-10 bg-white">
        <button
          onClick={() => setActiveTab('pedidos')}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
            activeTab === 'pedidos' ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent'
          }`}
        >
          Pedidos Recebidos
          {pedidosBadge > 0 && (
            <span className="bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
              {pedidosBadge}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('requisicoes')}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
            activeTab === 'requisicoes' ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent'
          }`}
        >
          Minhas Requisições
          {reqBadge > 0 && (
            <span className="bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
              {reqBadge}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-12 h-12 rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : queryError ? (
        <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-xs font-bold text-red-700 mb-1">Erro ao carregar:</p>
          <p className="text-xs font-mono text-red-600 break-all">{queryError}</p>
        </div>
      ) : currentList.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-700">
            {activeTab === 'pedidos' ? 'Nenhum pedido recebido ainda.' : 'Nenhuma requisição enviada ainda.'}
          </p>
          <p className="text-sm mt-1 text-gray-400">
            {activeTab === 'pedidos'
              ? 'Quando alguém solicitar um de seus itens, aparecerá aqui.'
              : 'Quando você solicitar um item, aparecerá aqui.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {currentList.map(conv => {
            const newest     = conv.solicitacoes[0];
            const st         = STATUS_LABEL[newest.status] ?? { label: newest.status, color: 'text-gray-500', bg: 'bg-gray-100' };
            const extraCount = conv.solicitacoes.length - 1;

            return (
              <button
                key={conv.otherId}
                onClick={() => openConversa(conv)}
                className="w-full px-4 py-4 flex items-center gap-3 hover:bg-gray-50 transition text-left"
              >
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
                    {conv.otherUser?.avatar_url
                      ? <img src={conv.otherUser.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      : <span className="text-blue-600 font-bold text-lg">{conv.otherUser?.fullName?.charAt(0) || '?'}</span>
                    }
                  </div>
                  {conv.needsAction && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h3 className="text-sm font-bold text-gray-900 truncate">{conv.otherUser?.fullName || 'Usuário'}</h3>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">{fmtDate(newest.data_inicio_prevista)}</span>
                  </div>
                  <p className="text-xs text-gray-600 truncate">
                    {newest.item?.nome}
                    {extraCount > 0 && (
                      <span className="text-gray-400 ml-1">+{extraCount} {extraCount === 1 ? 'aluguel' : 'aluguéis'}</span>
                    )}
                  </p>
                  <p className={`text-[10px] mt-1 font-semibold ${st.color}`}>● {st.label}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
