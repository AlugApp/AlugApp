import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alugapp.app',
  appName: 'AlugApp',
  // O app web da raiz do repositorio e' compilado em ../build e embarcado no APK/AAB.
  webDir: '../build',
  android: {
    allowMixedContent: false,
  },
};

export default config;
