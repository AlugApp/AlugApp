# Testes do AlugApp — QASE.IO

Gestão de testes do projeto (EAP 3.5 · Épico 10 · seção "Resultados de Teste" do documento).

## Estrutura

| Arquivo | Conteúdo |
|---|---|
| `qase/casos.json` | Catálogo versionado: planos, cenários (suítes) e casos de teste com passos, dados e resultado esperado, rastreados aos RFs/RNFs |
| `qase/ids.json` | Mapeamento chave → ID no Qase (gerado por `qase:sync`, versionar) |
| `src/**/__tests__/*.test.ts(x)`, `src/App.test.tsx` | Testes automatizados (Jest + Testing Library). O prefixo `[AUT-xxx]` no nome vincula ao caso no Qase |
| `scripts/qase/*.js` | Integração com a API do Qase (sem dependências extras) |
| `.github/workflows/ci.yml` | CI: tipos, testes, build e publicação do run no Qase em push na `main` |

### Organização no Qase

- **Planos**: Testes Internos (Sprint 04), Alfa (Sprint 05), Beta (Sprint 07)
- **Suítes (cenários)**: 01 Cadastro e perfil · 02 Autenticação e segurança · 03 Anúncios · 04 Catálogo e busca · 05 Fluxo de aluguel · 06 Chat e notificações · 07 Dashboard · 08 Administração · 09 Android e RNFs · 10 Automatizados
- **Casos**: `CT-001…CT-048` (manuais, funcionais) e `AUT-001…AUT-034` (automatizados, unitários/componente)

## Comandos

Defina as variáveis (PowerShell):

```powershell
$env:QASE_API_TOKEN = "<token em app.qase.io → APIs>"
$env:QASE_PROJECT_CODE = "<código do projeto, ex.: ALUG>"
```

| Comando | O que faz |
|---|---|
| `npm test` | Testes em modo interativo |
| `npm run test:ci` | Executa todos os testes uma vez e gera `test-results.json` |
| `npm run qase:sync` | Cria/atualiza suítes, casos e planos no Qase a partir de `qase/casos.json` |
| `npm run qase:report` | Publica o último `test-results.json` como Test Run (com link público) |
| `npm run qase:run-manual -- criar interno` | Cria o Test Run manual (também `alfa` / `beta`) para executar na interface do Qase |
| `npm run qase:run-manual -- resumo <runId>` | Gera o quadro-resumo em Markdown para o documento |

## Fluxo da entrega (testes internos — ambiente fechado)

1. `npm run qase:sync` (uma vez, ou quando o catálogo mudar)
2. `npm run test:ci` e `npm run qase:report` → run automatizado
3. `npm run qase:run-manual -- criar interno` → executar os casos CT na interface do Qase (web + Android da faixa de teste), registrando Pass/Fail e anexando evidências
4. Falhas viram issues no GitHub (template *Bug*) com o ID do caso
5. `npm run qase:run-manual -- resumo <idAutomatizado> <idManual>` → quadro-resumo da seção 13.1 do documento

No GitHub Actions, configure o secret `QASE_API_TOKEN` e a variável `QASE_PROJECT_CODE` para publicar automaticamente cada push na `main`.
