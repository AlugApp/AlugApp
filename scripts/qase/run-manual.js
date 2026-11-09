/* Test Runs manuais no QASE.IO.
 *
 *   npm run qase:run-manual -- criar [interno|alfa|beta]
 *       Cria um Test Run com os casos manuais do plano escolhido (padrão: interno),
 *       para ser executado na interface do Qase (Pass/Fail/Blocked por passo).
 *
 *   npm run qase:run-manual -- resumo <runId> [<runId> ...]
 *       Imprime o quadro-resumo (por suíte e total) em Markdown, usado na seção
 *       "Resultados de Teste" do documento, e gera link público do run.
 */
const { api, PROJECT, loadCatalog, loadIds, allCases, appVersion, hoje } = require('./qase-api');

const PLANOS = { interno: 'PLANO-INTERNO', alfa: 'PLANO-ALFA', beta: 'PLANO-BETA' };
const ROTULO = { interno: 'Testes internos manuais', alfa: 'Testes alfa (usuários-chave)', beta: 'Testes beta (usuários gerais)' };

async function criar(code, tipo = 'interno') {
  const ids = loadIds();
  const catalog = loadCatalog();
  const plano = (catalog.planos || []).find((p) => p.key === PLANOS[tipo]);
  if (!plano) throw new Error(`Plano desconhecido: ${tipo}`);
  const cases = allCases(catalog)
    .filter((c) => !c.automated)
    .filter((c) => tipo === 'interno' || (c.tags || []).some((t) => (plano.tags || []).includes(t)))
    .map((c) => ids.cases[c.key])
    .filter(Boolean);
  if (!cases.length) throw new Error('Nenhum caso mapeado. Rode "npm run qase:sync" antes.');

  const title = `${ROTULO[tipo]} · v${appVersion()} · ${hoje()}`;
  const run = await api('POST', `/run/${code}`, {
    title,
    description: `${plano.description}\nAmbientes: Web (Vercel) e Android (Play Store — faixa de teste).`,
    cases,
    // sem plan_id: vincular ao plano faria o Qase incluir os casos automatizados do plano no run
  });
  console.log(`Run #${run.id} "${title}" criado com ${cases.length} casos.`);
  console.log(`Executar em: https://app.qase.io/run/${code}/dashboard/${run.id}`);
}

const LABEL = { passed: 'Passou', failed: 'Falhou', blocked: 'Bloqueado', skipped: 'Pulado', invalid: 'Inválido', untested: 'Não executado' };

async function resumo(code, runIds) {
  const ids = loadIds();
  const catalog = loadCatalog();
  const byId = Object.fromEntries(Object.entries(ids.cases).map(([k, v]) => [v, k]));
  const suiteOf = Object.fromEntries(allCases(catalog).map((c) => [c.key, catalog.suites.find((s) => s.key === c.suiteKey).title]));

  for (const runId of runIds) {
    const run = await api('GET', `/run/${code}/${runId}?include=cases`);
    const results = [];
    for (let offset = 0; ; offset += 100) {
      const page = await api('GET', `/result/${code}?run=${runId}&limit=100&offset=${offset}`);
      results.push(...page.entities);
      if (page.entities.length < 100) break;
    }
    // último resultado de cada caso
    const last = {};
    for (const r of results.sort((a, b) => new Date(a.end_time || 0) - new Date(b.end_time || 0))) last[r.case_id] = r;

    const linhas = {};
    const total = { passed: 0, failed: 0, blocked: 0, skipped: 0, untested: 0 };
    const falhas = [];
    for (const caseId of run.cases || Object.keys(last).map(Number)) {
      const key = byId[caseId] || `#${caseId}`;
      const st = last[caseId] ? last[caseId].status : 'untested';
      const s = (linhas[suiteOf[key] || 'Outros'] ||= { passed: 0, failed: 0, blocked: 0, skipped: 0, untested: 0 });
      const k = st in total ? st : 'skipped';
      s[k]++;
      total[k]++;
      if (st === 'failed' || st === 'blocked') falhas.push(`${key} (${LABEL[st]})${last[caseId].comment ? ` — ${last[caseId].comment}` : ''}`);
    }

    let pub = '';
    try {
      pub = (await api('PATCH', `/run/${code}/${runId}/public`, { status: true })).url;
    } catch {
      /* link público pode estar desabilitado no plano do Qase */
    }

    const n = Object.values(total).reduce((a, b) => a + b, 0);
    const exec = n - total.untested;
    console.log(`\n## ${run.title} (run #${runId})\n`);
    console.log('| Cenário (suíte) | Casos | Passou | Falhou | Bloqueado | Não exec. |');
    console.log('|---|---|---|---|---|---|');
    for (const [suite, s] of Object.entries(linhas)) {
      const tot = Object.values(s).reduce((a, b) => a + b, 0);
      console.log(`| ${suite} | ${tot} | ${s.passed} | ${s.failed} | ${s.blocked} | ${s.untested + s.skipped} |`);
    }
    console.log(`| **Total** | **${n}** | **${total.passed}** | **${total.failed}** | **${total.blocked}** | **${total.untested + total.skipped}** |`);
    console.log(`\nTaxa de sucesso: ${exec ? ((total.passed / exec) * 100).toFixed(1) : '0.0'}% dos executados · cobertura de execução ${n ? ((exec / n) * 100).toFixed(1) : 0}%`);
    if (falhas.length) console.log(`Falhas/bloqueios:\n- ${falhas.join('\n- ')}`);
    console.log(`Run: https://app.qase.io/run/${code}/dashboard/${runId}${pub ? `\nRelatório público: ${pub}` : ''}`);
  }
}

(async () => {
  const code = PROJECT();
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === 'criar') return criar(code, args[0]);
  if (cmd === 'resumo' && args.length) return resumo(code, args);
  console.log('Uso: run-manual.js criar [interno|alfa|beta] | resumo <runId> [...]');
  process.exit(1);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
