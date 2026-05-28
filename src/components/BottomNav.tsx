import React from 'react';
import { Home as HomeIcon, PlusCircle, BarChart2, MessageSquare, User, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type AppMode =
  | 'home' | 'announce' | 'details' | 'perfil'
  | 'editar-perfil' | 'my-announcements' | 'edit-item' | 'dashboard' | 'chat';

interface BottomNavProps {
  mode: AppMode;
  navigate: (mode: AppMode) => void;
}

export default function BottomNav({ mode, navigate }: BottomNavProps) {
  const { signOut } = useAuth();

  const items: { key: AppMode | 'chat'; label: string; icon: React.FC<{ className?: string }> }[] = [
    { key: 'home',             label: 'Início',        icon: HomeIcon      },
    { key: 'my-announcements', label: 'Meus Anúncios', icon: PlusCircle    },
    { key: 'dashboard',        label: 'Dashboard',     icon: BarChart2     },
    { key: 'chat',             label: 'Chat',          icon: MessageSquare },
    { key: 'perfil',           label: 'Perfil',        icon: User          },
  ];

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
        return (
          <button
            key={key}
            onClick={() => navigate(key as AppMode)}
            className={`flex flex-col items-center gap-0.5 transition ${
              active ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Icon className="w-6 h-6" />
            <span className={`text-xs ${active ? 'font-medium' : ''}`}>{label}</span>
          </button>
        );
      })}
      <button
        onClick={() => signOut()}
        className="flex flex-col items-center gap-0.5 text-red-400 hover:text-red-600 transition"
      >
        <LogOut className="w-6 h-6" />
        <span className="text-xs">Sair</span>
      </button>
    </nav>
  );
}
