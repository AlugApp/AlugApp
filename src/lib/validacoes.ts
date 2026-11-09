// ─── Máscaras e validações de formulário ─────────────────────────────────────
// Centraliza as regras usadas em Cadastro, CompletarPerfil e EditarPerfil.

export const maskDate = (v: string): string => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

export const maskCPF = (v: string): string => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

export const maskPhone = (v: string): string => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

export const maskCEP = (v: string): string => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
};

/** Valida CPF pelo algoritmo dos dígitos verificadores (aceita com ou sem máscara). */
export const validateCPF = (cpf: string): boolean => {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calcVerifier = (slice: number) => {
    const numbers = digits.slice(0, slice).split('').map(Number);
    const factor = slice + 1;
    const total = numbers.reduce((acc, num, index) => acc + num * (factor - index), 0);
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return calcVerifier(9) === Number(digits[9]) && calcVerifier(10) === Number(digits[10]);
};
