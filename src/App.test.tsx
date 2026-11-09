import React from 'react';
import { render, screen } from '@testing-library/react';

// Funções simples (não jest.fn): o CRA usa resetMocks=true, que apagaria as implementações.
jest.mock('./lib/supabaseClient', () => {
  const noop = () => undefined;
  return {
    supabase: {
      auth: {
        getSession: () => Promise.resolve({ data: { session: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: noop } } }),
        signInWithPassword: () => Promise.resolve({ error: null }),
        signInWithOAuth: () => Promise.resolve({ error: null }),
        signOut: () => Promise.resolve({ error: null }),
        mfa: {
          getAuthenticatorAssuranceLevel: () =>
            Promise.resolve({ data: { currentLevel: 'aal1', nextLevel: 'aal1' } }),
          listFactors: () => Promise.resolve({ data: { totp: [] } }),
        },
      },
      from: noop,
      channel: noop,
      removeChannel: noop,
    },
  };
});

import App from './App';

// RF005 — sem sessão ativa, o usuário é direcionado para a autenticação
test('[AUT-029] App sem sessão ativa exibe a tela de Login', async () => {
  render(<App />);
  const titulos = await screen.findAllByRole('heading', { name: /entrar/i });
  expect(titulos.length).toBeGreaterThan(0);
  expect(screen.getAllByPlaceholderText(/e-mail/i).length).toBeGreaterThan(0);
  expect(screen.getAllByPlaceholderText(/senha/i).length).toBeGreaterThan(0);
});
