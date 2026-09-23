import React, { useEffect, useState } from 'react';
import { Home as HomeIcon, PlusCircle, BarChart2, MessageSquare, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

type AppMode =
  | 'home' | 'announce' | 'details' | 'perfil'
  | 'editar-perfil' | 'my-announcements' | 'edit-item' | 'dashboard' | 'chat' | 'admin';

interface BottomNavProps {
  mode: AppMode;
  navigate: (mode: AppMode) => void;
}

export default function BottomNav({ mode, navigate }: BottomNavProps) {
  const { profile } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from('solicitacao_aluguel')
      .select('idsolicitacao', { count: 'exact', head: true })
      .eq('idlocador', profile.id)
      .eq('status', 'pendente')
      .then(({ count }) => setPendingCount(count ?? 0));
  }, [profile?.id, mode]);

  const items = [
    { key: 'home',             label: 'Início',        icon: HomeIcon      },
    { key: 'my-announcements', label: 'Meus Anúncios', icon: PlusCircle    },
    { key: 'dashboard',        label: 'Dashboard',     icon: BarChart2     },
    { key: 'chat',             label: 'Chat',          icon: MessageSquare },
    { key: 'perfil',           label: 'Perfil',        icon: User          },
  ] as const;

  const isActive = (key: string): boolean => {
    if (key === 'home')             return mode === 'home';
    if (key === 'my-announcements') return ['my-announcements', 'edit-item', 'announce'].includes(mode);
    if (key === 'dashboard')        return mode === 'dashboard';
    if (key === 'chat')             return mode === 'chat';
    if (key === 'perfil')           return ['perfil', 'editar-perfil'].includes(mode);
    return false;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-16 flex justify-around items-center px-4 z-50">
      {items.map(({ key, label, icon: Icon }) => {
        const active = isActive(key);
        const showBadge = key === 'chat' && pendingCount > 0;

        return (
          <button
            key={key}
            onClick={() => navigate(key as AppMode)}
            className={`flex flex-col items-center gap-0.5 transition ${
              active ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className="relative">
              <Icon className="w-6 h-6" />
              {showBadge && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </div>
            <span className={`text-xs ${active ? 'font-medium' : ''}`}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
