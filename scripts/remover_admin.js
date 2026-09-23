/**
 * =========================================================================================
 *                          MECANISMO DE GERENCIAMENTO DE ADMINS
 *                               (SCRIPT DE TERMINAL / CLI)
 * =========================================================================================
 * 
 * Este script permite revogar ou restaurar privilégios de administrador de qualquer usuário
 * informando o e-mail, de forma totalmente OCULTA da interface da plataforma web.
 * 
 * -----------------------------------------------------------------------------------------
 * COMO UTILIZAR:
 * -----------------------------------------------------------------------------------------
 * 1. MODO INTERATIVO (Pergunta o e-mail no terminal):
 *    $ npm run remover-admin
 *    ou
 *    $ node scripts/remover_admin.js
 * 
 * 2. MODO DIRETO (Passando o e-mail como argumento):
 *    $ node scripts/remover_admin.js usuario@exemplo.com
 * 
 * 3. MODO RESTAURAÇÃO (Reverter a revogação e permitir que volte a ser admin):
 *    $ node scripts/remover_admin.js --restaurar usuario@exemplo.com
 * 
 * -----------------------------------------------------------------------------------------
 * NOTAS DE FUNCIONAMENTO:
 * -----------------------------------------------------------------------------------------
 * - Quando um e-mail é revogado, ele é registrado em 'src/config/revoked_admins.json'.
 * - O sistema em tempo de execução bloqueia o acesso desse usuário como administrador.
 * - Caso você decida promovê-lo novamente no futuro, você pode:
 *     a) Clicar em "Tornar Admin" no próprio Painel de Administração da plataforma com a senha.
 *        O sistema automaticamente cancelará a revogação e restaurará o acesso.
 *     b) Rodar este script com o comando: node scripts/remover_admin.js --restaurar <email>
 * =========================================================================================
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Caminho do arquivo de configuração de administradores revogados
const CONFIG_FILE = path.join(__dirname, '..', 'src', 'config', 'revoked_admins.json');

// Função auxiliar para carregar lista atual
function loadRevokedList() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      fs.writeFileSync(CONFIG_FILE, '[]\n', 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Erro ao ler arquivo de revogações:', err.message);
    return [];
  }
}

// Função auxiliar para salvar a lista
function saveRevokedList(list) {
  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(list, null, 2) + '\n', 'utf-8');
  } catch (err) {
    console.error('Erro ao salvar arquivo de revogações:', err.message);
  }
}

// Processa a revogação de um e-mail
function revogarAdmin(email) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    console.error('\n❌ Erro: Formato de e-mail inválido.\n');
    process.exit(1);
  }

  const list = loadRevokedList();
  if (!list.includes(cleanEmail)) {
    list.push(cleanEmail);
    saveRevokedList(list);
    console.log(`\n✅ Sucesso! O usuário '${cleanEmail}' teve seus privilégios de Administrador REVOGADOS.`);
    console.log(`ℹ️  A alteração foi salva em src/config/revoked_admins.json e entrará em vigor na aplicação.\n`);
  } else {
    console.log(`\nℹ️  O usuário '${cleanEmail}' já consta na lista de administradores revogados.\n`);
  }
}

// Processa a restauração de um e-mail
function restaurarAdmin(email) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    console.error('\n❌ Erro: Formato de e-mail inválido.\n');
    process.exit(1);
  }

  let list = loadRevokedList();
  if (list.includes(cleanEmail)) {
    list = list.filter((e) => e.toLowerCase() !== cleanEmail);
    saveRevokedList(list);
    console.log(`\n✅ Sucesso! O usuário '${cleanEmail}' foi REMOVIDO da lista de revogados.`);
    console.log(`ℹ️  Agora ele poderá ser promovido a Administrador novamente normalmente.\n`);
  } else {
    console.log(`\nℹ️  O usuário '${cleanEmail}' não estava na lista de revogados.\n`);
  }
}

// Execução principal
function main() {
  const args = process.argv.slice(2);

  // Modo: --restaurar <email>
  if (args[0] === '--restaurar' || args[0] === '-r') {
    const email = args[1];
    if (email) {
      restaurarAdmin(email);
      return;
    }
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('\nDigite o e-mail do usuário para RESTAURAR e permitir papel de Admin: ', (answer) => {
      restaurarAdmin(answer);
      rl.close();
    });
    return;
  }

  // Modo direto com e-mail como primeiro argumento
  if (args[0] && !args[0].startsWith('-')) {
    revogarAdmin(args[0]);
    return;
  }

  // Modo interativo via terminal
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\n======================================================');
  console.log('       REVOGAÇÃO DE PRIVILÉGIOS DE ADMINISTRADOR      ');
  console.log('======================================================');
  rl.question('\nDigite o e-mail do usuário que deseja REMOVER de Admin: ', (answer) => {
    revogarAdmin(answer);
    rl.close();
  });
}

main();
