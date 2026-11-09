// RF002 / RNF010 — criptografia AES do CPF e hash SHA-256
export {};

type CryptoModule = typeof import('../crypto');

const ORIGINAL_KEY = process.env.REACT_APP_ENCRYPTION_KEY;

function loadCrypto(key: string | undefined): CryptoModule {
  if (key === undefined) delete process.env.REACT_APP_ENCRYPTION_KEY;
  else process.env.REACT_APP_ENCRYPTION_KEY = key;
  let mod!: CryptoModule;
  jest.isolateModules(() => {
    mod = require('../crypto');
  });
  return mod;
}

afterAll(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.REACT_APP_ENCRYPTION_KEY;
  else process.env.REACT_APP_ENCRYPTION_KEY = ORIGINAL_KEY;
});

describe('Criptografia de dados sensíveis (RF002, RNF010)', () => {
  test('[AUT-008] encrypt/decrypt fazem ida e volta e o texto cifrado difere do original', () => {
    const { encrypt, decrypt } = loadCrypto('chave-de-teste-123');
    const cpf = '529.982.247-25';
    const cifrado = encrypt(cpf);
    expect(cifrado).not.toBe(cpf);
    expect(cifrado).not.toContain('529');
    expect(decrypt(cifrado)).toBe(cpf);
  });

  test('[AUT-009] encrypt gera cifras diferentes para o mesmo valor (salt aleatório)', () => {
    const { encrypt } = loadCrypto('chave-de-teste-123');
    expect(encrypt('52998224725')).not.toBe(encrypt('52998224725'));
  });

  test('[AUT-010] decrypt devolve o valor original quando o dado não está cifrado (legado) ou a chave é outra', () => {
    const { decrypt } = loadCrypto('chave-de-teste-123');
    expect(decrypt('52998224725')).toBe('52998224725');
    expect(decrypt('')).toBe('');

    const outra = loadCrypto('outra-chave');
    const cifradoOutraChave = outra.encrypt('52998224725');
    const { decrypt: decryptChaveErrada } = loadCrypto('chave-de-teste-123');
    expect(decryptChaveErrada(cifradoOutraChave)).not.toBe('52998224725');
  });

  test('[AUT-011] hashCPF ignora a máscara e gera SHA-256 determinístico de 64 caracteres', () => {
    const { hashCPF } = loadCrypto('chave-de-teste-123');
    const h1 = hashCPF('529.982.247-25');
    const h2 = hashCPF('52998224725');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCPF('111.444.777-35')).not.toBe(h1);
  });
});
