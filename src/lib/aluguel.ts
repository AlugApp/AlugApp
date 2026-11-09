// ─── Regras de negócio de preço e período de aluguel ─────────────────────────

const DIA_MS = 86400000;

/** Extrai os dias da semana bloqueados de forma recorrente (sentinelas "REC:<0-6>"). */
export function parseSentinels(datas: string[]): number[] {
  return datas
    .filter((d) => d.startsWith('REC:'))
    .map((d) => Number(d.split(':')[1]));
}

/**
 * Indica se o período [inicio, fim] (datas "AAAA-MM-DD") contém alguma data
 * indisponível pontual ou algum dia da semana bloqueado de forma recorrente.
 */
export function rangeContemIndisponivel(
  datasIndisponiveis: string[],
  inicio: string,
  fim: string
): boolean {
  if (!inicio || !fim) return false;
  const start = new Date(inicio + 'T12:00:00');
  const end = new Date(fim + 'T12:00:00');
  for (const ds of datasIndisponiveis) {
    if (ds.startsWith('REC:')) continue;
    const d = new Date(ds + 'T12:00:00');
    if (d >= start && d <= end) return true;
  }
  const recorrentes = parseSentinels(datasIndisponiveis);
  if (recorrentes.length > 0) {
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (recorrentes.includes(d.getDay())) return true;
    }
  }
  return false;
}

/** Calcula quantidade de diárias e valor total previsto. Retorna null se o período for inválido. */
export function calcularTotal(
  inicio: string,
  fim: string,
  valorDiario: number
): { dias: number; total: number } | null {
  if (!inicio || !fim) return null;
  const dias = Math.ceil((new Date(fim).getTime() - new Date(inicio).getTime()) / DIA_MS);
  if (!Number.isFinite(dias) || dias <= 0) return null;
  return { dias, total: dias * Number(valorDiario) };
}

/**
 * Calcula os valores semanal (7 diárias) e mensal (30 diárias), base e com desconto percentual.
 * Descontos inválidos/vazios são tratados como 0%.
 */
export function calcularPrecosPeriodo(
  diario: number,
  descontoSemanalPct: string | number,
  descontoMensalPct: string | number
) {
  const semanalBase = diario > 0 ? +(diario * 7).toFixed(2) : 0;
  const mensalBase = diario > 0 ? +(diario * 30).toFixed(2) : 0;
  const semanalFinal =
    semanalBase > 0 ? +(semanalBase * (1 - (Number(descontoSemanalPct) || 0) / 100)).toFixed(2) : 0;
  const mensalFinal =
    mensalBase > 0 ? +(mensalBase * (1 - (Number(descontoMensalPct) || 0) / 100)).toFixed(2) : 0;
  return { semanalBase, mensalBase, semanalFinal, mensalFinal };
}
