import React, { useState } from 'react';
import Home from './pages/Home';
import Login from './pages/Login';
import Cadastro from './pages/Cadastro';
import AnunciarItem from './pages/CadastrarItem';
import ItemDetalhes from './pages/DetalhesItem';
import Perfil from './pages/Perfil';
import EditarPerfil from './pages/EditarPerfil';

type AuthMode = 'login' | 'register' | 'home' | 'announce' | 'details' | 'perfil' | 'editar-perfil';

const App: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  // =======================
  // DETALHES DO ITEM
  // =======================
  if (mode === 'details' && selectedItemId !== null) {
    return (
      <ItemDetalhes
        id={selectedItemId}
        onGoBack={() => setMode('home')}
      />
    );
  }

  // =======================
  // HOME
  // =======================
  if (mode === 'home') {
    return (
      <Home
        onGoToAnnounce={() => setMode('announce')}
        onGoToPerfil={() => setMode('perfil')}
        onOpenItem={(id) => {
          setSelectedItemId(id);
          setMode('details');
        }}
      />
    );
  }

  // =======================
  // LOGIN
  // =======================
  if (mode === 'login') {
    return (
      <Login
        onGoToRegister={() => setMode('register')}
        onLoginSuccess={() => setMode('home')}
      />
    );
  }

  // =======================
  // CADASTRO
  // =======================
  if (mode === 'register') {
    return (
      <Cadastro onGoToLogin={() => setMode('login')} />
    );
  }

  // =======================
  // ANUNCIAR ITEM
  // =======================
  if (mode === 'announce') {
    return (
      <AnunciarItem onGoBack={() => setMode('home')} />
    );
  }

  // =======================
  // PERFIL
  // =======================
  if (mode === 'perfil') {
    return (
      <Perfil
        onGoBack={() => setMode('home')}
        onLogout={() => setMode('login')}
        onGoToEditar={() => setMode('editar-perfil')}
      />
    );
  }

  // =======================
  // EDITAR PERFIL
  // =======================
  if (mode === 'editar-perfil') {
    return (
      <EditarPerfil
        onGoBack={() => setMode('perfil')}
        onGoHome={() => setMode('home')}
      />
    );
  }

  // =======================
  // DEFAULT
  // =======================
  return null; // <- Garante que sempre retorna algo
};

export default App;