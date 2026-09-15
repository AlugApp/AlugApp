// Resolve a toolchain portatil (JDK + Android SDK) em mobile/.toolchain.
// Assim o build nao depende de Android Studio nem de JAVA_HOME na maquina.
import { existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MOBILE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
export const TOOLCHAIN_DIR = join(MOBILE_DIR, '.toolchain');
export const SDK_DIR = join(TOOLCHAIN_DIR, 'android-sdk');

export function findJdk() {
  if (!existsSync(TOOLCHAIN_DIR)) return null;
  const dir = readdirSync(TOOLCHAIN_DIR).find((d) => d.startsWith('jdk-'));
  return dir ? join(TOOLCHAIN_DIR, dir) : null;
}

// Monta o env do Gradle. Cai para o JAVA_HOME do sistema se a toolchain sumiu.
export function buildEnv() {
  const jdk = findJdk() ?? process.env.JAVA_HOME;
  if (!jdk) {
    throw new Error(
      'JDK nao encontrado. Rode `npm run setup:toolchain` para baixar a toolchain portatil.'
    );
  }
  if (!existsSync(SDK_DIR)) {
    throw new Error(
      'Android SDK nao encontrado. Rode `npm run setup:toolchain` para baixar a toolchain portatil.'
    );
  }
  return {
    ...process.env,
    JAVA_HOME: jdk,
    ANDROID_HOME: SDK_DIR,
    ANDROID_SDK_ROOT: SDK_DIR,
    PATH: `${join(jdk, 'bin')}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`,
  };
}
