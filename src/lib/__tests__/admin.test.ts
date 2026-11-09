jest.mock('../supabaseClient', () => {
  const chain: any = {
    update: jest.fn(() => chain),
    eq: jest.fn(() => Promise.resolve({ error: null })),
  };
  return { supabase: { from: jest.fn(() => chain) } };
});

import {
  addAdminAuditLog,
  banUser,
  clearAdminAuditLogs,
  getAdminAuditLogs,
  isAdmin,
  isUserBanned,
  unbanUser,
} from '../admin';

// RF032 — RBAC / RF034 — banimento com proteção de admins / RF037, RNF009 — trilha de auditoria
describe('Módulo administrativo (RF032, RF034, RF037)', () => {
  const ORIGINAL_ADMINS = process.env.REACT_APP_ADMIN_EMAILS;
  beforeEach(() => {
    localStorage.clear();
    process.env.REACT_APP_ADMIN_EMAILS = 'admin.teste@alugapp.com';
  });
  afterAll(() => {
    process.env.REACT_APP_ADMIN_EMAILS = ORIGINAL_ADMINS;
  });

  test('[AUT-024] isAdmin reconhece papel admin nos metadados e no perfil', () => {
    expect(isAdmin({ email: 'x@y.com', app_metadata: { role: 'admin' } } as any, null)).toBe(true);
    expect(isAdmin({ email: 'x@y.com', user_metadata: { role: 'admin' } } as any, null)).toBe(true);
    expect(isAdmin(null, { email: 'x@y.com', role: 'admin' } as any)).toBe(true);
    expect(isAdmin(null, null)).toBe(false);
  });

  test('[AUT-025] isAdmin aceita e-mail autorizado ignorando caixa e espaços, e nega usuário comum', () => {
    expect(isAdmin({ email: '  Admin.Teste@AlugApp.com ' } as any, null)).toBe(true);
    expect(isAdmin({ email: 'usuario.comum@gmail.com' } as any, null)).toBe(false);
  });

  test('[AUT-026] isAdmin nega acesso a administrador com permissão revogada', () => {
    localStorage.setItem('alugapp_revoked_admins', JSON.stringify(['admin.teste@alugapp.com']));
    expect(isAdmin({ email: 'admin.teste@alugapp.com', app_metadata: { role: 'admin' } } as any, null)).toBe(false);
  });

  test('[AUT-027] banUser bane usuário comum e bloqueia o banimento de administradores', async () => {
    const r = await banUser({ id: 42, email: 'Locatario@Teste.com', fullName: 'Locatário Teste' });
    expect(r.success).toBe(true);
    expect(isUserBanned('locatario@teste.com')).toBe(true);
    expect(isUserBanned(42)).toBe(true);

    const adm = await banUser({ email: 'admin.teste@alugapp.com' });
    expect(adm.success).toBe(false);
    expect(isUserBanned('admin.teste@alugapp.com')).toBe(false);

    await unbanUser({ id: 42, email: 'locatario@teste.com' });
    expect(isUserBanned('locatario@teste.com')).toBe(false);
    expect(isUserBanned(42)).toBe(false);
  });

  test('[AUT-028] trilha de auditoria registra data, autor, ação e alvo, mantendo os 300 mais recentes', () => {
    addAdminAuditLog({ admin_email: 'adm@alugapp.com', action: 'ban_user', target: 'user@x.com' });
    const [log] = getAdminAuditLogs();
    expect(log).toMatchObject({ admin_email: 'adm@alugapp.com', action: 'ban_user', target: 'user@x.com' });
    expect(new Date(log.timestamp).toISOString()).toBe(log.timestamp);

    for (let i = 0; i < 310; i++) {
      addAdminAuditLog({ admin_email: 'adm@alugapp.com', action: 'ban_user', target: `u${i}` });
    }
    const logs = getAdminAuditLogs();
    expect(logs).toHaveLength(300);
    expect(logs[0].target).toBe('u309');

    clearAdminAuditLogs();
    expect(getAdminAuditLogs()).toEqual([]);
  });
});
