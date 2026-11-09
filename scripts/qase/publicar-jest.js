/* Publica no QASE.IO o resultado da execução do Jest como um Test Run.
 * Cada teste com "[AUT-xxx]" no nome é vinculado ao caso correspondente.
 *
 *   npm run test:ci                      # gera test-results.json
 *   QASE_API_TOKEN=... QASE_PROJECT_CODE=ALUG npm run qase:report
 *
 * Opcional: QASE_RUN_TITLE para personalizar o título do run.
 */
const fs = require('fs');
const path = require('path');
const { api, PROJECT, loadIds, appVersion, hoje, ROOT } = require('./qase-api');

const RESULTS_FILE = process.argv[2] || path.join(ROOT, 'test-results.json');
const STATUS = { passed: 'passed', failed: 'failed', pending: 'skipped', skipped: 'skipped', todo: 'skipped', disabled: 'skipped' };

(async () => {
  const code = PROJECT();
  const ids = loadIds();
  if (!fs.existsSync(RESULTS_FILE)) throw new Error(`Arquivo ${RESULTS_FILE} não encontrado. Rode "npm run test:ci" antes.`);
  const jest = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));

  const results = [];
  const semCaso = [];
  for (const file of jest.testResults) {
    const rel = path.relative(ROOT, file.name).replace(/\\/g, '/');
    for (const t of file.assertionResults) {
      const m = /\[(AUT-\d+)\]/.exec(t.title);
      const caseId = m && ids.cases[m[1]];
      if (!caseId) {
        semCaso.push(t.fullName);
        continue;
      }
      const failure = (t.failureMessages || []).join('\n').replace(/\u001b\[[0-9;]*m/g, '');
      results.push({
        case_id: caseId,
        status: STATUS[t.status] || 'skipped',
        time_ms: Math.max(0, Math.round(t.duration || 0)),
        comment: `${rel} — ${t.fullName}`,
        stacktrace: failure ? failure.slice(0, 5000) : undefined,
      });
    }
  }
  if (!results.length) throw new Error('Nenhum teste com [AUT-xxx] mapeado em qase/ids.json. Rode "npm run qase:sync" antes.');

  const ci = process.env.GITHUB_ACTIONS
    ? `\nCI: ${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID} (commit ${String(process.env.GITHUB_SHA).slice(0, 7)})`
    : '\nExecução local pelos desenvolvedores.';
  const title =
    process.env.QASE_RUN_TITLE ||
    `Testes internos automatizados · v${appVersion()} · ${hoje()}${process.env.GITHUB_ACTIONS ? ' · CI' : ''}`;

  const run = await api('POST', `/run/${code}`, {
    title,
    description: `Jest + Testing Library (unitários e de componente).\nSuítes: ${jest.numTotalTestSuites} · Testes: ${jest.numTotalTests} · Passaram: ${jest.numPassedTests} · Falharam: ${jest.numFailedTests}.${ci}`,
    cases: [...new Set(results.map((r) => r.case_id))],
    // sem plan_id: vincular ao plano faria o Qase incluir também os casos manuais do plano no run
  });
  await api('POST', `/result/${code}/${run.id}/bulk`, { results });
  await api('POST', `/run/${code}/${run.id}/complete`);

  let publicUrl = '';
  try {
    publicUrl = (await api('PATCH', `/run/${code}/${run.id}/public`, { status: true })).url;
  } catch (e) {
    console.warn(`Não foi possível gerar link público do run: ${e.message}`);
  }

  const passed = results.filter((r) => r.status === 'passed').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  console.log(`Run #${run.id} "${title}": ${results.length} resultados (${passed} passaram, ${failed} falharam).`);
  console.log(`Run no Qase: https://app.qase.io/run/${code}/dashboard/${run.id}`);
  if (publicUrl) console.log(`Relatório público: ${publicUrl}`);
  if (semCaso.length) console.log(`Testes sem caso no Qase (ignorados): \n  - ${semCaso.join('\n  - ')}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### QASE.IO\nRun #${run.id}: ${passed} passaram, ${failed} falharam.${publicUrl ? ` [Relatório](${publicUrl})` : ''}\n`
    );
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
