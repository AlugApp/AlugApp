/* Sincroniza qase/casos.json com o projeto do QASE.IO:
 * cria/atualiza suítes (cenários), casos de teste e planos de teste.
 * Idempotente: os IDs criados ficam em qase/ids.json (versionado).
 *
 *   QASE_API_TOKEN=... QASE_PROJECT_CODE=ALUG npm run qase:sync
 */
const { api, PROJECT, ENUMS, loadCatalog, loadIds, saveIds, allCases } = require('./qase-api');

function casePayload(c, suiteId, automated) {
  const rf = c.rf || [];
  const description = [
    automated
      ? `Teste automatizado (Jest + Testing Library).\nArquivo: ${c.file}\nIdentificador no código: [${c.key}]`
      : `Caso de teste funcional ${c.key}.`,
    rf.length ? `Requisitos cobertos: ${rf.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const payload = {
    title: `${c.key} · ${c.title}`,
    description,
    preconditions: c.preconditions || (automated ? 'Dependências instaladas (npm ci). Supabase e APIs externas simulados (mock).' : ''),
    suite_id: suiteId,
    severity: ENUMS.severity[c.severity || 'normal'],
    priority: ENUMS.priority[c.priority || (automated ? 'medium' : 'medium')],
    type: ENUMS.type[c.type || 'functional'],
    behavior: ENUMS.behavior[c.behavior || 'positive'],
    layer: ENUMS.layer[c.layer || (automated ? 'unit' : 'e2e')],
    automation: automated ? ENUMS.automation.automated : ENUMS.automation.manual,
    status: 0,
    tags: [...rf, ...(c.tags || []), automated ? 'automatizado' : 'manual'],
  };

  if (automated) {
    payload.steps = [
      {
        action: `Executar: npx react-scripts test --watchAll=false -t "${c.key}"`,
        expected_result: `Teste "[${c.key}] ${c.title}" passa`,
      },
    ];
  } else {
    payload.steps = (c.steps || []).map((s, i) => ({
      position: i + 1,
      action: s.action,
      expected_result: s.expected_result || '',
      data: s.data || '',
    }));
  }
  return payload;
}

async function upsertSuite(code, ids, s) {
  const body = { title: s.title, description: s.description, preconditions: '' };
  if (ids.suites[s.key]) {
    try {
      await api('PATCH', `/suite/${code}/${ids.suites[s.key]}`, body);
      return ids.suites[s.key];
    } catch (e) {
      if (e.status !== 404) throw e;
    }
  }
  const r = await api('POST', `/suite/${code}`, body);
  ids.suites[s.key] = r.id;
  return r.id;
}

async function upsertCase(code, ids, c, suiteId, automated) {
  const body = casePayload(c, suiteId, automated);
  if (ids.cases[c.key]) {
    try {
      await api('PATCH', `/case/${code}/${ids.cases[c.key]}`, body);
      return 'atualizado';
    } catch (e) {
      if (e.status !== 404) throw e;
    }
  }
  const r = await api('POST', `/case/${code}`, body);
  ids.cases[c.key] = r.id;
  return 'criado';
}

async function upsertPlan(code, ids, plan, catalog) {
  const cases = allCases(catalog).filter((c) => {
    if (plan.suites && plan.suites.includes('*')) return true;
    if (plan.tags) return !c.automated && (c.tags || []).some((t) => plan.tags.includes(t));
    return false;
  });
  const body = {
    title: plan.title,
    description: plan.description,
    cases: cases.map((c) => ids.cases[c.key]).filter(Boolean),
  };
  if (ids.plans[plan.key]) {
    try {
      await api('PATCH', `/plan/${code}/${ids.plans[plan.key]}`, body);
      return body.cases.length;
    } catch (e) {
      if (e.status !== 404) throw e;
    }
  }
  const r = await api('POST', `/plan/${code}`, body);
  ids.plans[plan.key] = r.id;
  return body.cases.length;
}

(async () => {
  const code = PROJECT();
  const catalog = loadCatalog();
  const ids = loadIds();

  const project = await api('GET', `/project/${code}`);
  console.log(`Projeto Qase: ${project.title} (${code})`);
  ids.project = code;

  const cont = { criado: 0, atualizado: 0 };
  for (const s of catalog.suites) {
    const suiteId = await upsertSuite(code, ids, s);
    for (const c of s.cases) {
      cont[await upsertCase(code, ids, c, suiteId, !!s.automated)]++;
    }
    saveIds(ids);
    console.log(`  ✔ ${s.title} — ${s.cases.length} casos`);
  }
  for (const p of catalog.planos || []) {
    const n = await upsertPlan(code, ids, p, catalog);
    console.log(`  ✔ Plano "${p.title}" — ${n} casos`);
  }
  saveIds(ids);
  console.log(`\nCasos criados: ${cont.criado} · atualizados: ${cont.atualizado}. IDs salvos em qase/ids.json.`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
