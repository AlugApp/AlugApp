/* Cliente mínimo da API v1 do QASE.IO (https://developers.qase.io).
 * Variáveis de ambiente:
 *   QASE_API_TOKEN     token pessoal/de API (obrigatório)
 *   QASE_PROJECT_CODE  código do projeto no Qase, ex.: ALUG (obrigatório)
 */
const fs = require('fs');
const path = require('path');

const BASE = process.env.QASE_API_URL || 'https://api.qase.io/v1';
const ROOT = path.resolve(__dirname, '..', '..');
const CASOS_FILE = path.join(ROOT, 'qase', 'casos.json');
const IDS_FILE = path.join(ROOT, 'qase', 'ids.json');

function env(name) {
  const v = (process.env[name] || '').trim();
  if (!v) {
    console.error(`Defina a variável de ambiente ${name}.`);
    process.exit(1);
  }
  return v;
}

const PROJECT = () => env('QASE_PROJECT_CODE').toUpperCase();

async function api(method, route, body) {
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers: {
      Token: env('QASE_API_TOKEN'),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok || json.status === false) {
    const err = new Error(`Qase ${method} ${route} -> HTTP ${res.status}: ${text.slice(0, 600)}`);
    err.status = res.status;
    throw err;
  }
  return json.result;
}

const ENUMS = {
  severity: { blocker: 1, critical: 2, major: 3, normal: 4, minor: 5, trivial: 6 },
  priority: { high: 1, medium: 2, low: 3 },
  type: {
    other: 1, functional: 2, smoke: 3, regression: 4, security: 5, usability: 6,
    performance: 7, acceptance: 8, compatibility: 9, integration: 10, exploratory: 11,
  },
  behavior: { undefined: 1, positive: 2, negative: 3, destructive: 4 },
  layer: { e2e: 1, api: 2, unit: 3 },
  automation: { manual: 0, 'to-be-automated': 1, automated: 2 },
};

function loadCatalog() {
  return JSON.parse(fs.readFileSync(CASOS_FILE, 'utf8'));
}

function loadIds() {
  if (!fs.existsSync(IDS_FILE)) return { project: null, suites: {}, cases: {}, plans: {} };
  return JSON.parse(fs.readFileSync(IDS_FILE, 'utf8'));
}

function saveIds(ids) {
  fs.writeFileSync(IDS_FILE, JSON.stringify(ids, null, 2) + '\n', 'utf8');
}

/** Retorna todos os casos do catálogo com a suíte de origem. */
function allCases(catalog) {
  return catalog.suites.flatMap((s) =>
    s.cases.map((c) => ({ ...c, suiteKey: s.key, automated: !!s.automated }))
  );
}

function appVersion() {
  try {
    const gradle = fs.readFileSync(path.join(ROOT, 'mobile', 'android', 'app', 'build.gradle'), 'utf8');
    const m = gradle.match(/versionName\s+"([^"]+)"/);
    if (m) return m[1];
  } catch {
    /* sem projeto android */
  }
  return require(path.join(ROOT, 'package.json')).version;
}

function hoje() {
  return new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

module.exports = { api, PROJECT, ENUMS, loadCatalog, loadIds, saveIds, allCases, appVersion, hoje, ROOT };
