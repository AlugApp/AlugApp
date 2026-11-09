import {
  calcularPrecosPeriodo,
  calcularTotal,
  parseSentinels,
  rangeContemIndisponivel,
} from '../aluguel';

// RF015 — preços por período / RF016 — indisponibilidade / RF023 — solicitação de aluguel
describe('Regras de preço e período do aluguel (RF015, RF016, RF023)', () => {
  test('[AUT-019] calcularTotal conta as diárias do período e multiplica pela diária', () => {
    expect(calcularTotal('2026-11-10', '2026-11-12', 50)).toEqual({ dias: 2, total: 100 });
    expect(calcularTotal('2026-11-10', '2026-11-11', 35.5)).toEqual({ dias: 1, total: 35.5 });
    // virada de mês
    expect(calcularTotal('2026-11-28', '2026-12-03', 10)).toEqual({ dias: 5, total: 50 });
  });

  test('[AUT-020] calcularTotal rejeita período vazio, invertido ou com início igual ao fim', () => {
    expect(calcularTotal('', '2026-11-12', 50)).toBeNull();
    expect(calcularTotal('2026-11-12', '', 50)).toBeNull();
    expect(calcularTotal('2026-11-12', '2026-11-10', 50)).toBeNull();
    expect(calcularTotal('2026-11-12', '2026-11-12', 50)).toBeNull();
  });

  test('[AUT-021] rangeContemIndisponivel detecta data pontual bloqueada dentro do período (inclusive bordas)', () => {
    const bloqueadas = ['2026-11-15', '2026-12-25'];
    expect(rangeContemIndisponivel(bloqueadas, '2026-11-14', '2026-11-16')).toBe(true);
    expect(rangeContemIndisponivel(bloqueadas, '2026-11-15', '2026-11-15')).toBe(true);
    expect(rangeContemIndisponivel(bloqueadas, '2026-11-10', '2026-11-15')).toBe(true);
    expect(rangeContemIndisponivel(bloqueadas, '2026-11-16', '2026-11-20')).toBe(false);
    expect(rangeContemIndisponivel(bloqueadas, '', '')).toBe(false);
  });

  test('[AUT-022] rangeContemIndisponivel respeita bloqueio recorrente por dia da semana', () => {
    // REC:0 = domingo, REC:6 = sábado. 10/11/2026 é terça-feira.
    expect(parseSentinels(['REC:0', '2026-11-15', 'REC:6'])).toEqual([0, 6]);
    const fimDeSemana = ['REC:0', 'REC:6'];
    expect(rangeContemIndisponivel(fimDeSemana, '2026-11-10', '2026-11-13')).toBe(false); // ter -> sex
    expect(rangeContemIndisponivel(fimDeSemana, '2026-11-10', '2026-11-14')).toBe(true); // inclui sábado
    expect(rangeContemIndisponivel(['REC:0'], '2026-11-14', '2026-11-14')).toBe(false); // só sábado
  });

  test('[AUT-023] calcularPrecosPeriodo aplica 7/30 diárias e os descontos semanal e mensal', () => {
    expect(calcularPrecosPeriodo(50, '10', '20')).toEqual({
      semanalBase: 350,
      mensalBase: 1500,
      semanalFinal: 315,
      mensalFinal: 1200,
    });
    expect(calcularPrecosPeriodo(50, '0', '0')).toMatchObject({ semanalFinal: 350, mensalFinal: 1500 });
    expect(calcularPrecosPeriodo(19.99, '', 'abc')).toMatchObject({ semanalFinal: 139.93, mensalFinal: 599.7 });
    expect(calcularPrecosPeriodo(0, '10', '20')).toEqual({
      semanalBase: 0,
      mensalBase: 0,
      semanalFinal: 0,
      mensalFinal: 0,
    });
  });
});
