# AlugApp — build Android (Capacitor)

Empacotamento Android do AlugApp para publicação no Google Play Console.

O AlugApp é um app **web** (Create React App, na raiz do repositório). Esta pasta
não duplica nenhum código de tela: ela compila o app web em `../build` e embarca
esse bundle dentro de um container nativo via [Capacitor](https://capacitorjs.com).
O resultado é um `.aab` (Android App Bundle), único formato aceito pelo Play Console.

```
raiz/           app web React  ──build──▶  ../build/  ──cap sync──▶  mobile/android/  ──gradle──▶  .aab
```

## Identidade do app

| Campo | Valor |
|---|---|
| Application ID | `com.alugapp.app` |
| Nome exibido | AlugApp |
| versionCode | `4` |
| versionName | `1.0.3` |
| minSdk / targetSdk | 24 (Android 7.0) / 36 |

> ⚠️ O **Application ID é permanente**. Depois que a primeira build subir no Play
> Console ele nunca mais pode ser alterado — o app teria que ser republicado do
> zero, com nova ficha e perdendo instalações e avaliações. Confirme
> `com.alugapp.app` antes do primeiro upload. Para trocar agora: ajuste `appId` em
> `capacitor.config.ts`, apague `android/` e rode `npx cap add android`.

## Como gerar uma nova build

```bash
# 1. compila o app web (na raiz)
cd ..
CI=false npm run build

# 2. embarca o bundle e gera o AAB assinado
cd mobile
npm run build:android
```

O arquivo sai em `android/app/build/outputs/bundle/release/app-release.aab` e é
copiado para `dist/AlugApp-<versionName>-<versionCode>.aab`.

Para instalar num aparelho e testar antes de subir, gere um APK:

```bash
npm run build:apk    # dist/AlugApp-<versionName>-<versionCode>.apk
```

O AAB **não** instala direto no celular — é um formato de distribuição que o Play
converte em APKs por aparelho. Use o APK para teste local.

### A cada nova versão

Incremente `versionCode` (inteiro, sempre crescente — o Play recusa um valor já
usado) e `versionName` em `android/app/build.gradle`.

## Toolchain

`.toolchain/` contém um JDK 21 e o Android SDK portáteis (~2 GB), baixados
localmente e **fora do versionamento** — não é preciso instalar Android Studio
nem mexer no PATH da máquina. Os scripts npm apontam para eles automaticamente.

Se a pasta for perdida, `npm run setup:toolchain` a reconstrói.

## Assinatura

O Play exige o AAB assinado. A chave de upload está em
`alugapp-upload.keystore`, com as senhas em `keystore.properties`. **Os dois estão
no `.gitignore` e nunca devem ser versionados.**

> 🔐 **Faça backup dos dois arquivos fora do repositório** (gerenciador de senhas
> ou drive privado). Perder a chave de upload trava o envio de atualizações — a
> recuperação depende de abrir um chamado no suporte do Google.

Como o Play App Signing fica ativo por padrão, esta é a chave de *upload*: o
Google reassina o app com a chave de distribuição dele antes de entregar aos
usuários.

## Permissões declaradas

| Permissão | Por quê |
|---|---|
| `INTERNET`, `ACCESS_NETWORK_STATE` | Supabase (dados, auth, chat em tempo real) |
| `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` | motor de localização — `navigator.geolocation` é ponteado pela WebView do Capacitor, que pede a permissão em runtime |

O GPS é declarado como `required="false"`, então aparelhos sem GPS continuam
podendo instalar o app.

## Deep links de autenticação (links de e-mail e login com Google)

Dentro da WebView do Capacitor a origem é `http://localhost`, então os retornos do
Supabase usam um esquema próprio do app (decisão registrada no ADR 0001 do
repositório institucional):

```
com.alugapp.app://auth-callback
```

| Peça | Onde |
|---|---|
| `intent-filter` (VIEW/BROWSABLE, `scheme=com.alugapp.app`, `host=auth-callback`) | `android/app/src/main/AndroidManifest.xml` |
| `redirectTo` / `emailRedirectTo` nativos quando `Capacitor.isNativePlatform()` | `src/lib/deepLink.ts` (`emailRedirectUrl`, `oauthRedirectUrl`) usado em `Cadastro.tsx`, `Login.tsx` e `RecuperarSenha.tsx` |
| Leitura da URL recebida (`appUrlOpen` + `getLaunchUrl`), `setSession` / `exchangeCodeForSession` e abertura da tela *Redefinir senha* quando `type=recovery` | `src/lib/deepLink.ts` (`initDeepLinks`), registrado em `App.tsx` |
| Plugin `@capacitor/app` | `package.json` (raiz, JS) e `mobile/package.json` (nativo, via `cap sync`) |

Na web nada muda: os links continuam voltando para a origem do site e o
`supabase-js` lê a sessão da URL sozinho.

### Configuração no painel do Supabase (obrigatória, fora do repositório)

1. Supabase → projeto do AlugApp → **Authentication → URL Configuration**.
2. Em **Redirect URLs**, clique em **Add URL** e adicione exatamente:
   `com.alugapp.app://auth-callback`
3. Mantenha a URL da Vercel em **Site URL** e na lista (a web continua usando).
4. Salve.

Sem esse passo o Supabase ignora o `redirectTo` do app e devolve o usuário para
a *Site URL* (site na Vercel), que era o comportamento anterior.

### Como testar no aparelho

1. Gere e instale a build (`npm run build:apk` ou pela faixa de teste).
2. **Redefinição de senha:** no app, *Esqueci minha senha* → abra o e-mail no
   celular → o link abre o AlugApp na tela *Redefinir senha*.
3. **Confirmação de cadastro:** cadastre-se pelo app → abra o link do e-mail →
   o AlugApp abre já autenticado.
4. **Google:** *Entrar com Google* abre o navegador do sistema → após escolher a
   conta, o AlugApp volta ao primeiro plano autenticado.
5. Link expirado/reutilizado: o app avisa "Este link expirou ou já foi usado".

Teste rápido sem e-mail (aparelho conectado via USB):

```bash
adb shell am start -W -a android.intent.action.VIEW -d "com.alugapp.app://auth-callback#error=access_denied&error_code=otp_expired" com.alugapp.app
```
