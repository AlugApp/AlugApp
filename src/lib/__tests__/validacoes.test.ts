import { maskCEP, maskCPF, maskDate, maskPhone, validateCPF } from '../validacoes';

// RF002 — validação de CPF por dígitos verificadores / RF001 e RF003 — máscaras do cadastro
describe('Validações e máscaras do cadastro (RF001, RF002, RF003)', () => {
  test('[AUT-001] validateCPF aceita CPF válido com e sem máscara', () => {
    expect(validateCPF('529.982.247-25')).toBe(true);
    expect(validateCPF('52998224725')).toBe(true);
    expect(validateCPF('111.444.777-35')).toBe(true);
  });

  test('[AUT-002] validateCPF rejeita CPF com dígito verificador incorreto', () => {
    expect(validateCPF('529.982.247-24')).toBe(false);
    expect(validateCPF('111.444.777-36')).toBe(false);
  });

  test('[AUT-003] validateCPF rejeita sequência repetida, tamanho inválido e vazio', () => {
    expect(validateCPF('111.111.111-11')).toBe(false);
    expect(validateCPF('000.000.000-00')).toBe(false);
    expect(validateCPF('123.456.789')).toBe(false);
    expect(validateCPF('123456789012')).toBe(false);
    expect(validateCPF('')).toBe(false);
  });

  test('[AUT-004] maskCPF formata progressivamente e limita a 11 dígitos', () => {
    expect(maskCPF('529')).toBe('529');
    expect(maskCPF('5299')).toBe('529.9');
    expect(maskCPF('5299822')).toBe('529.982.2');
    expect(maskCPF('52998224725')).toBe('529.982.247-25');
    expect(maskCPF('52998224725999')).toBe('529.982.247-25');
    expect(maskCPF('abc529.982x24725')).toBe('529.982.247-25');
  });

  test('[AUT-005] maskPhone formata telefone com DDD', () => {
    expect(maskPhone('61')).toBe('61');
    expect(maskPhone('619954')).toBe('(61) 9954');
    expect(maskPhone('61995487878')).toBe('(61) 99548-7878');
    expect(maskPhone('6199548787899')).toBe('(61) 99548-7878');
  });

  test('[AUT-006] maskCEP formata CEP no padrão 00000-000', () => {
    expect(maskCEP('70790')).toBe('70790');
    expect(maskCEP('70790075')).toBe('70790-075');
    expect(maskCEP('70790-0751')).toBe('70790-075');
  });

  test('[AUT-007] maskDate formata data de nascimento DD/MM/AAAA', () => {
    expect(maskDate('10')).toBe('10');
    expect(maskDate('1011')).toBe('10/11');
    expect(maskDate('10112000')).toBe('10/11/2000');
    expect(maskDate('101120001')).toBe('10/11/2000');
  });
});
