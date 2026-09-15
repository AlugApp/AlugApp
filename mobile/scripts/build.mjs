// Gera o artefato Android assinado.
//   node scripts/build.mjs aab   -> App Bundle para o Play Console
//   node scripts/build.mjs apk   -> APK instalavel para teste em aparelho
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildEnv, MOBILE_DIR } from './toolchain.mjs';

const kind = process.argv[2] === 'apk' ? 'apk' : 'aab';
const ANDROID_DIR = join(MOBILE_DIR, 'android');

// O AAB embarca o bundle web; sem ele o app abriria numa tela em branco.
if (!existsSync(join(MOBILE_DIR, '..', 'build', 'index.html'))) {
  console.error('\n../build nao existe. Compile o app web primeiro:\n  cd .. && CI=false npm run build\n');
  process.exit(1);
}

const env = buildEnv();
// caminho absoluto: com shell:true no Windows o cwd nao entra no PATH
const gradlew = join(ANDROID_DIR, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
const task = kind === 'aab' ? 'bundleRelease' : 'assembleRelease';

const run = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, env, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

run('npx', ['cap', 'sync', 'android'], MOBILE_DIR);
run(gradlew, [task, '--no-daemon'], ANDROID_DIR);

// Nomeia o artefato com a versao, para nao confundir uploads no Play Console.
const gradleFile = readFileSync(join(ANDROID_DIR, 'app', 'build.gradle'), 'utf8');
const versionName = gradleFile.match(/versionName\s+"([^"]+)"/)?.[1] ?? '0';
const versionCode = gradleFile.match(/versionCode\s+(\d+)/)?.[1] ?? '0';

const from =
  kind === 'aab'
    ? join(ANDROID_DIR, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab')
    : join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');

const distDir = join(MOBILE_DIR, 'dist');
mkdirSync(distDir, { recursive: true });
const to = join(distDir, `AlugApp-${versionName}-${versionCode}.${kind}`);
copyFileSync(from, to);

console.log(`\n✔ ${kind.toUpperCase()} gerado: mobile/dist/AlugApp-${versionName}-${versionCode}.${kind}`);
