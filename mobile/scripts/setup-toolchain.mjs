// Reconstroi mobile/.toolchain (JDK 21 + Android SDK) do zero.
// Sao ~2 GB baixados da Microsoft e do Google; nada e' instalado no sistema.
import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { TOOLCHAIN_DIR, SDK_DIR, findJdk } from './toolchain.mjs';

const JDK_URL = 'https://aka.ms/download-jdk/microsoft-jdk-21.0.12-windows-x64.zip';
const CMDLINE_URL = 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip';

if (process.platform !== 'win32') {
  console.error('Este script cobre apenas Windows. Em outro SO, instale JDK 21 e o Android SDK e exporte JAVA_HOME/ANDROID_HOME.');
  process.exit(1);
}

mkdirSync(TOOLCHAIN_DIR, { recursive: true });

// tar.exe lida com os caminhos longos do SDK melhor que Expand-Archive.
const fetchAndExtract = (url, dest) => {
  const zip = join(TOOLCHAIN_DIR, 'download.zip');
  execFileSync('curl.exe', ['-L', '-o', zip, url], { stdio: 'inherit' });
  mkdirSync(dest, { recursive: true });
  execFileSync('tar.exe', ['-xf', zip, '-C', dest], { stdio: 'inherit' });
  rmSync(zip);
};

if (!findJdk()) {
  console.log('Baixando JDK 21...');
  fetchAndExtract(JDK_URL, TOOLCHAIN_DIR);
}

const cmdlineDir = join(SDK_DIR, 'cmdline-tools');
if (!existsSync(join(cmdlineDir, 'latest'))) {
  console.log('Baixando Android command-line tools...');
  fetchAndExtract(CMDLINE_URL, cmdlineDir);
  renameSync(join(cmdlineDir, 'cmdline-tools'), join(cmdlineDir, 'latest'));
}

// O sdkmanager nao aceita licenca por stdin em modo nao-interativo;
// os hashes abaixo sao os que ele grava ao aceitar manualmente.
const licenses = {
  'android-sdk-license':
    '\n8933bad161af4178b1185d1a37fbf41ea5269c55\nd56f5187479451eabf01fb78af6dfcb131a6481e\n24333f8a63b6825ea9c5514f83c2829b004d1fee\n',
  'android-sdk-preview-license': '\n84831b9409646a918e30573bab4c9c91346d8abd\n',
  'android-sdk-arm-dbt-license': '\n859f317696f67ef3d7f30a50a5560e7834b43903\n',
};
mkdirSync(join(SDK_DIR, 'licenses'), { recursive: true });
for (const [name, body] of Object.entries(licenses)) {
  writeFileSync(join(SDK_DIR, 'licenses', name), body);
}

console.log('Instalando pacotes do SDK...');
const r = spawnSync(
  join(cmdlineDir, 'latest', 'bin', 'sdkmanager.bat'),
  [`--sdk_root=${SDK_DIR}`, 'platform-tools', 'platforms;android-36', 'build-tools;36.0.0'],
  { stdio: 'inherit', shell: true, env: { ...process.env, JAVA_HOME: findJdk() } }
);
if (r.status !== 0) process.exit(r.status ?? 1);

writeFileSync(
  join(TOOLCHAIN_DIR, '..', 'android', 'local.properties'),
  `sdk.dir=${SDK_DIR.replace(/\/g, '/')}\n`
);
console.log('\n✔ Toolchain pronta.');
