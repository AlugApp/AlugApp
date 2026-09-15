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
| versionCode | `1` |
| versionName | `1.0.0` |
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

## Limitação conhecida: links de e-mail do Supabase

`Cadastro.tsx`, `Login.tsx` e `RecuperarSenha.tsx` passam
`redirectTo: window.location.origin` ao Supabase. Dentro da WebView do Capacitor
esse valor é `http://localhost`, e não a URL da Vercel — então **confirmação de
e-mail e redefinição de senha não voltam para o app** na versão Android.

Resolver exige três passos combinados:

1. registrar um deep link (`com.alugapp.app://`) no `AndroidManifest.xml`;
2. trocar o `redirectTo` por esse esquema quando rodando nativo, e tratar o
   retorno com o plugin `@capacitor/app` (`appUrlOpen`);
3. adicionar a URL à allowlist de *Redirect URLs* no painel do Supabase.

O passo 3 é feito no painel do Supabase, fora deste repositório — por isso a
correção ficou de fora desta build inicial. Para um teste interno fechado o
restante do app funciona normalmente; vale resolver antes de abrir para produção.
