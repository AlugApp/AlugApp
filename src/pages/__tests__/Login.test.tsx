import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signInWithOAuth: jest.fn(),
    },
  },
}));

import Login from '../Login';
import { supabase } from '../../lib/supabaseClient';

const signIn = supabase.auth.signInWithPassword as jest.Mock;
const signInOAuth = supabase.auth.signInWithOAuth as jest.Mock;

function renderLogin() {
  const utils = render(
    <Login onGoToRegister={jest.fn()} onForgotPassword={jest.fn()} onLoginSuccess={jest.fn()} />
  );
  // A tela renderiza um layout mobile e outro desktop; usamos o primeiro formulário.
  const email = screen.getAllByPlaceholderText('E-mail')[0] as HTMLInputElement;
  const senha = screen.getAllByPlaceholderText('Senha')[0] as HTMLInputElement;
  const form = email.closest('form') as HTMLFormElement;
  return { ...utils, email, senha, form };
}

beforeEach(() => jest.clearAllMocks());

// RF005 — autenticação por e-mail e senha / RF006 — Google OAuth
describe('Tela de Login (RF005, RF006)', () => {
  test('[AUT-030] Login exige e-mail e senha antes de chamar o Supabase', async () => {
    const { form } = renderLogin();
    fireEvent.submit(form);
    expect((await screen.findAllByText('Preencha e-mail e senha.')).length).toBeGreaterThan(0);
    expect(signIn).not.toHaveBeenCalled();
  });

  test('[AUT-031] Login com credenciais inválidas exibe mensagem amigável', async () => {
    signIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    const { email, senha, form } = renderLogin();
    fireEvent.change(email, { target: { value: 'teste@alugapp.com' } });
    fireEvent.change(senha, { target: { value: 'senhaErrada' } });
    fireEvent.submit(form);
    expect((await screen.findAllByText('E-mail ou senha inválidos.')).length).toBeGreaterThan(0);
    expect(signIn).toHaveBeenCalledWith({ email: 'teste@alugapp.com', password: 'senhaErrada' });
  });

  test('[AUT-032] Login com e-mail não confirmado orienta o usuário a confirmar o cadastro', async () => {
    signIn.mockResolvedValue({ error: { message: 'Email not confirmed' } });
    const { email, senha, form } = renderLogin();
    fireEvent.change(email, { target: { value: 'novo@alugapp.com' } });
    fireEvent.change(senha, { target: { value: 'Senha@123' } });
    fireEvent.submit(form);
    expect((await screen.findAllByText(/E-mail não confirmado/)).length).toBeGreaterThan(0);
  });

  test('[AUT-033] Login com credenciais válidas confirma o acesso', async () => {
    signIn.mockResolvedValue({ error: null });
    const { email, senha, form } = renderLogin();
    fireEvent.change(email, { target: { value: 'teste@alugapp.com' } });
    fireEvent.change(senha, { target: { value: 'Senha@123' } });
    fireEvent.submit(form);
    expect((await screen.findAllByText('Login realizado! Redirecionando...')).length).toBeGreaterThan(0);
  });

  test('[AUT-034] Botão Google inicia OAuth com o provedor google e URL de retorno', async () => {
    signInOAuth.mockResolvedValue({ error: null });
    renderLogin();
    fireEvent.click(screen.getAllByRole('button', { name: /google/i })[0]);
    await waitFor(() => expect(signInOAuth).toHaveBeenCalled());
    const arg = signInOAuth.mock.calls[0][0];
    expect(arg.provider).toBe('google');
    expect(arg.options.redirectTo).toBeTruthy();
  });
});
