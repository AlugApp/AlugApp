import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Send, CheckCircle, XCircle, MessageSquare } from 'lucide-react';

interface Solicitacao {
  idsolicitacao: number;
  iditem: number;
  idlocador: number;
  idlocatario: number;
  data_inicio_prevista: string;
  data_fim_prevista: string;
  valor_total_previsto: number;
  status: string;
  created_at: string;
  item?: { nome: string; foto_url?: string };
  locador_user?: { fullName: string; avatar_url?: string };
  locatario_user?: { fullName: string; avatar_url?: string };
}

interface ChatProps {
  onGoBack: () => void;
  onGoToPerfil: () => void;
  onGoToMyAnnouncements: () => void;
}

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');

export default function Chat({ onGoBack, onGoToPerfil, onGoToMyAnnouncements }: ChatProps) {
  const { profile } = useAuth();
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSol, setSelectedSol] = useState<Solicitacao | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    const load = async () => {
      setLoading(true);
      // Fetch solicitacoes onde sou locador OU locatario
      const { data, error } = await supabase
        .from('solicitacao_aluguel')
        .select('*, item(nome), locador_user:users!idlocador(fullName, avatar_url), locatario_user:users!idlocatario(fullName, avatar_url)')
        .or(`idlocador.eq.${profile.id},idlocatario.eq.${profile.id}`)
        .order('created_at', { ascending: false });

      if (!error && data) {
        // Also fetch fotos for the items
        const itemIds = data.map(d => d.iditem);
        const { data: fotos } = await supabase.from('fotoitem').select('iditem, url_foto').in('iditem', itemIds);
        
        const merged = data.map((s: any) => {
          const f = fotos?.find(fot => fot.iditem === s.iditem);
          return {
            ...s,
            item: { ...s.item, foto_url: f?.url_foto },
            // Workaround for PostgREST join mapping if needed
            locador_user: Array.isArray(s.locador_user) ? s.locador_user[0] : s.locador_user,
            locatario_user: Array.isArray(s.locatario_user) ? s.locatario_user[0] : s.locatario_user,
          };
        });
        setSolicitacoes(merged);
      }
      setLoading(false);
    };
    load();
  }, [profile?.id]);

  const handleResponder = async (id: number, novoStatus: 'aprovado' | 'rejeitado') => {
    const { error } = await supabase.from('solicitacao_aluguel').update({ status: novoStatus }).eq('idsolicitacao', id);
    if (!error) {
      setSolicitacoes(prev => prev.map(s => s.idsolicitacao === id ? { ...s, status: novoStatus } : s));
      if (selectedSol?.idsolicitacao === id) {
        setSelectedSol(prev => prev ? { ...prev, status: novoStatus } : null);
      }
    }
  };

  if (selectedSol) {
    const isLocador = selectedSol.idlocador === profile?.id;
    const otherUser = isLocador ? selectedSol.locatario_user : selectedSol.locador_user;

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col pb-20">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSelectedSol(null)} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
            {otherUser?.avatar_url ? (
              <img src={otherUser.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-blue-600 font-bold">{otherUser?.fullName?.charAt(0) || '?'}</span>
            )}
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">{otherUser?.fullName || 'Usuário'}</h2>
            <p className="text-xs text-gray-500">{isLocador ? 'Locatário' : 'Locador'}</p>
          </div>
        </header>

        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          <div className="flex justify-center">
            <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
              Solicitação iniciada em {new Date(selectedSol.created_at).toLocaleDateString('pt-BR')}
            </span>
          </div>

          <div className="flex flex-col gap-1 max-w-[85%] mr-auto">
            <div className="bg-white rounded-2xl rounded-tl-sm border border-gray-200 shadow-sm p-4">
              <p className="text-sm text-gray-800 font-medium mb-3">
                {isLocador ? 'Nova solicitação de aluguel recebida:' : 'Você enviou uma solicitação de aluguel:'}
              </p>
              
              <div className="flex gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100 mb-3">
                <div className="w-16 h-16 rounded-lg bg-gray-200 flex-shrink-0 overflow-hidden">
                  {selectedSol.item?.foto_url && (
                    <img src={selectedSol.item.foto_url} alt="Item" className="w-full h-full object-cover" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 leading-tight">{selectedSol.item?.nome}</p>
                  <p className="text-xs text-gray-500 mt-1">De {fmtDate(selectedSol.data_inicio_prevista)}</p>
                  <p className="text-xs text-gray-500">Até {fmtDate(selectedSol.data_fim_prevista)}</p>
                  <p className="text-sm font-bold text-blue-700 mt-1">{fmtBRL(selectedSol.valor_total_previsto)}</p>
                </div>
              </div>

              {selectedSol.status === 'pendente' && isLocador && (
                <div className="flex gap-2 mt-2">
                  <button onClick={() => handleResponder(selectedSol.idsolicitacao, 'rejeitado')} className="flex-1 py-2 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition">
                    Rejeitar
                  </button>
                  <button onClick={() => handleResponder(selectedSol.idsolicitacao, 'aprovado')} className="flex-1 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition">
                    Aceitar
                  </button>
                </div>
              )}

              {selectedSol.status === 'pendente' && !isLocador && (
                <p className="text-xs text-yellow-600 font-medium text-center bg-yellow-50 py-1.5 rounded-lg">Aguardando resposta do locador...</p>
              )}

              {selectedSol.status === 'aprovado' && (
                <p className="text-xs text-green-700 font-medium flex items-center justify-center gap-1 bg-green-50 py-1.5 rounded-lg">
                  <CheckCircle className="w-4 h-4" /> Solicitação Aprovada
                </p>
              )}

              {selectedSol.status === 'rejeitado' && (
                <p className="text-xs text-red-700 font-medium flex items-center justify-center gap-1 bg-red-50 py-1.5 rounded-lg">
                  <XCircle className="w-4 h-4" /> Solicitação Rejeitada
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border-t border-gray-200 p-3 flex gap-2">
          <input type="text" placeholder="Digite uma mensagem..." disabled className="flex-1 bg-gray-100 rounded-full px-4 text-sm focus:outline-none" />
          <button disabled className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white opacity-50">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">Chat</h1>
      </header>

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
      ) : solicitacoes.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p>Nenhuma conversa ou solicitação ainda.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {solicitacoes.map(sol => {
            const isLocador = sol.idlocador === profile?.id;
            const otherUser = isLocador ? sol.locatario_user : sol.locador_user;
            
            return (
              <button
                key={sol.idsolicitacao}
                onClick={() => setSelectedSol(sol)}
                className="w-full px-4 py-4 flex items-center gap-3 hover:bg-gray-50 transition text-left"
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {otherUser?.avatar_url ? (
                      <img src={otherUser.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-blue-600 font-bold text-lg">{otherUser?.fullName?.charAt(0) || '?'}</span>
                    )}
                  </div>
                  {sol.status === 'pendente' && isLocador && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 border-2 border-white rounded-full" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h3 className="text-sm font-bold text-gray-900 truncate">{otherUser?.fullName || 'Usuário'}</h3>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
                      {new Date(sol.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 truncate">
                    {isLocador ? 'Solicitação de aluguel para: ' : 'Você solicitou: '} {sol.item?.nome}
                  </p>
                  <p className="text-[10px] mt-1 font-medium">
                    {sol.status === 'pendente' ? <span className="text-yellow-600">Pendente</span> :
                     sol.status === 'aprovado' ? <span className="text-green-600">Aprovado</span> :
                     <span className="text-red-600">Rejeitado</span>}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
