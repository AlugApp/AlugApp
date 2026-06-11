# AlugApp — Documentação Técnica

> Ultima atualização: 10/06/2026  
> Plataforma: React 19 + Supabase + TailwindCSS

---

## 1. Visão Geral

O **AlugApp** é uma plataforma web de **aluguel de itens entre pessoas** (peer-to-peer). Qualquer usuário pode ser ao mesmo tempo **locador** (quem disponibiliza o item) e **locatário** (quem aluga). O sistema é inteiramente baseado em **React (TypeScript)** no front-end e **Supabase** como back-end (banco de dados PostgreSQL, autenticação, armazenamento de arquivos).

### Tecnologias principais

| Camada | Tecnologia |
|--------|-----------|
| Framework UI | React 19 + TypeScript |
| Estilização | TailwindCSS 3 |
| Back-end / BaaS | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Ícones | Lucide React + React Icons |
| Criptografia | CryptoJS (AES + SHA-256) |
| Roteamento | Navegação por estado (`AppMode`) — sem React Router |
| Deploy | Vercel |
| API externa | ViaCEP (auto-preenchimento de endereço) |
| Validação de e-mail | Disify API |

---

## 2. Estrutura de Pastas

```
src/
├── App.tsx                  # Roteador principal por estado + MFA
├── index.tsx                # Entry point React
├── types.ts                 # Tipos globais (mínimo)
├── components/
│   └── BottomNav.tsx        # Barra de navegação inferior fixa (com badge de pendentes)
├── contexts/
│   └── AuthContext.tsx      # Sessão, perfil, signOut globais
├── lib/
│   ├── supabaseClient.ts    # Instância única do cliente Supabase
│   ├── crypto.ts            # encrypt / decrypt / hashCPF
│   ├── geocoding.ts         # Geocodificação de endereços (Nominatim)
│   └── censura.ts           # Lista de palavras censuradas + funções de filtro
└── pages/
    ├── Login.tsx            # Login e-mail + OAuth Google
    ├── Cadastro.tsx         # Cadastro completo com validações
    ├── CompletarPerfil.tsx  # Complemento de perfil pós-OAuth
    ├── RecuperarSenha.tsx   # Envio de e-mail de reset
    ├── RedefinirSenha.tsx   # Formulário de nova senha (link do e-mail)
    ├── Home.tsx             # Listagem pública de itens + filtros + notificações
    ├── DetalhesItem.tsx     # Página do item + solicitação de aluguel
    ├── CadastrarItem.tsx    # Formulário de criação de anúncio
    ├── EditarItem.tsx       # Formulário de edição de anúncio
    ├── MeusAnuncios.tsx     # Listagem dos anúncios do usuário logado
    ├── Perfil.tsx           # Perfil: dados, segurança, MFA, exclusão
    ├── EditarPerfil.tsx     # Edição de dados pessoais e endereço
    ├── Dashboard.tsx        # Estatísticas (locador / locatário)
    └── Chat.tsx             # Chat: solicitações + mensagens em tempo real
```

---

## 3. Banco de Dados Supabase

### 3.1 Tabelas

#### `users` — Perfil do usuário
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | bigint PK | ID interno (serial) |
| `auth_id` | uuid UNIQUE | ID do Supabase Auth |
| `fullName` | text | Nome completo |
| `email` | text UNIQUE | E-mail |
| `cpf` | text UNIQUE | CPF criptografado (AES) |
| `phone` | text UNIQUE | Telefone mascarado |
| `gender` | text | `male` / `female` / `other` |
| `birthDate` | date | Data de nascimento |
| `cep` | text | CEP |
| `rua` | text | Logradouro |
| `numero` | text | Número |
| `complemento` | text | Complemento (opcional) |
| `bairro` | text | Bairro |
| `cidade` | text | Cidade |
| `estado` | text | UF (2 letras) |
| `avatar_url` | text | URL do avatar (Google ou upload) |

#### `categoria` — Categorias de itens
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `idcategoria` | int PK | ID da categoria |
| `nome_categoria` | text | Nome exibido |

#### `item` — Anúncios de itens
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `iditem` | int PK | ID do item |
| `idlocador` | uuid | `auth_id` do dono (FK → auth.users) |
| `idcategoria` | int | FK → categoria |
| `nome` | text | Título |
| `descricao` | text | Descrição (pode conter prefixo `[subtipo]`) |
| `estado` | text | `Novo` / `Seminovo` / `Usado` |
| `valor_aluguel_diario` | numeric | Preço por dia |
| `valor_aluguel_semana` | numeric | Preço semanal (com desconto) |
| `valor_aluguel_mensal` | numeric | Preço mensal (com desconto) |
| `adicionais` | text[] | Ex: `["Entrega incluída"]` |
| `datas_indisponiveis` | text[] | Ex: `["2025-06-10", "REC:0"]` |
| `disponivel` | boolean | `TRUE` = disponível para aluguel, `FALSE` = aluguel ativo. Gerenciado automaticamente pelo trigger `trg_atualiza_disponivel` |
| `latitude` | float8 | Latitude geocodificada do endereço do locador |
| `longitude` | float8 | Longitude geocodificada do endereço do locador |
| `created_at` | timestamptz | Data de criação |

> **Sentinelas de indisponibilidade recorrente:** strings no formato `"REC:<dia_da_semana>"` onde 0=Domingo, 6=Sábado. São misturadas no array `datas_indisponiveis` junto com datas ISO específicas.

#### `fotoitem` — Fotos dos itens
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `idfotoitem` | int PK | ID da foto |
| `iditem` | int | FK → item |
| `url_foto` | text | URL pública no Supabase Storage (bucket `items`) |
| `ordem_exibicao` | int | Ordem da exibição (1 = capa) |

#### `solicitacao_aluguel` — Solicitações de aluguel
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `idsolicitacao` | int PK | ID da solicitação |
| `iditem` | int | FK → item |
| `idlocador` | int | FK → users.id (locador) |
| `idlocatario` | int | FK → users.id (locatário) |
| `data_inicio_prevista` | date | Início do período |
| `data_fim_prevista` | date | Fim do período |
| `valor_total_previsto` | numeric | dias × diária |
| `status` | text | Ver tabela de status abaixo |
| `foto_antes_url` | text | URL da foto do item tirada pelo locador antes da entrega |
| `foto_recebimento_url` | text | URL da foto tirada pelo locatário ao confirmar o recebimento |

**Ciclo de vida do status (`solicitacao_aluguel.status`):**

| Status | Quem age | Ação |
|--------|----------|------|
| `pendente` | Locador | Aceitar → `aprovado` / Rejeitar → `rejeitado` |
| `pendente` | Locatário | Cancelar → `cancelado` |
| `aprovado` | Locador | Fotografar estado do item → `aguardando_entrega` |
| `aguardando_entrega` | Locatário | Confirmar recebimento com foto → `em_andamento` |
| `em_andamento` | Locatário | Devolver item → `concluido` |
| `rejeitado` / `cancelado` / `concluido` | — | Estado terminal |

> Ao mudar para `aprovado`, `aguardando_entrega` ou `em_andamento`, o trigger `trg_atualiza_disponivel` define `item.disponivel = FALSE`. Ao mudar para `concluido`, `cancelado` ou `rejeitado`, define `item.disponivel = TRUE`.

#### `mensagem` — Mensagens do chat
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `idmensagem` | serial PK | ID da mensagem |
| `idsolicitacao` | int | FK → solicitacao_aluguel |
| `idremetente` | int | FK → users.id (quem enviou) |
| `conteudo` | text | Texto da mensagem (pré-censurado) |
| `criado_em` | timestamptz | Data/hora de envio |

> Habilitar Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE mensagem;`

#### `avaliacao` — Avaliações de usuários
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `idavaliacao` | int PK | ID |
| `idavaliado` | int | FK → users.id (quem foi avaliado) |
| `idavaliador` | int | FK → users.id (quem avaliou) |
| `nota` | numeric | Nota (escala usada no código: 1–10) |

### 3.2 Storage

- **Bucket:** `items` (público)
- **Fotos de itens:** `{iditem}-{timestamp}-{index}`
- **Avatares:** `avatars/{auth_id}`
- **Fotos de estado de aluguel:** `rental/{idsolicitacao}-antes-{timestamp}` / `rental/{idsolicitacao}-recebimento-{timestamp}`
- **URL gerada:** `https://<supabase_url>/storage/v1/object/public/items/<filename>`

### 3.3 Funções RPC (PostgreSQL)

| Função | Parâmetros | Uso |
|--------|-----------|-----|
| `cleanup_orphaned_auth_user` | `p_email text` | Remove registro órfão de `auth.users` sem perfil em `users` |
| `delete_user_account` | `input_password text` | Verifica senha, remove todos os dados do usuário e deleta conta do Auth |

### 3.4 Triggers

| Trigger | Tabela | Evento | Ação |
|---------|--------|--------|------|
| `trg_atualiza_disponivel` | `solicitacao_aluguel` | `AFTER UPDATE` | Chama `fn_atualiza_disponivel_item()` com `SECURITY DEFINER` — define `item.disponivel` conforme o novo status da solicitação |

**Lógica do trigger:**
- Status → `aprovado`, `aguardando_entrega` ou `em_andamento`: define `disponivel = FALSE`
- Status → `concluido`, `cancelado` ou `rejeitado`: define `disponivel = TRUE`

---

## 4. Autenticação e Sessão

### 4.1 `supabaseClient.ts`
Exporta uma **instância única** do cliente Supabase configurada via variáveis de ambiente:
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_TOKEN` (chave `anon`)
- `REACT_APP_ENCRYPTION_KEY` (chave AES para CPF)

### 4.2 `AuthContext.tsx`

Contexto global que expõe:

```ts
{
  session: Session | null,
  user: User | null,
  profile: UserProfile | null,   // linha da tabela users
  loading: boolean,
  refreshProfile: () => Promise<void>,
  signOut: () => Promise<void>,
}
```

**Fluxo de inicialização:**
1. `getSession()` → se há sessão ativa, carrega o perfil via `fetchProfile(authId)`
2. `onAuthStateChange` escuta eventos subsequentes:
   - `TOKEN_REFRESHED` → atualiza sessão silenciosamente
   - `SIGNED_OUT` → limpa tudo
   - `SIGNED_IN` real (novo login) → recarrega perfil
   - `INITIAL_SESSION` → ignorado (já tratado pelo `getSession`)

**Descriptografia do CPF:** ao buscar o perfil, o campo `cpf` é automaticamente descriptografado com `decrypt()` antes de ser armazenado no contexto.

### 4.3 Criptografia (`crypto.ts`)

| Função | Descrição |
|--------|-----------|
| `encrypt(text)` | Criptografa string com AES usando `REACT_APP_ENCRYPTION_KEY` |
| `decrypt(ciphertext)` | Descriptografa; retorna o ciphertext original em caso de erro |
| `hashCPF(cpf)` | SHA-256 dos dígitos puros do CPF (para buscas por igualdade sem expor o dado) |

> **Nota:** O CPF é salvo **criptografado** no banco via `encrypt()` na página de cadastro e descriptografado apenas na exibição.

### 4.4 Censura de conteúdo (`censura.ts`)

Helper de filtragem de linguagem inapropriada aplicado antes do envio de mensagens no chat.

| Função | Descrição |
|--------|-----------|
| `censurarTexto(texto)` | Substitui palavras proibidas por `*` do mesmo comprimento |
| `contemPalavraProibida(texto)` | Retorna `true` se o texto contiver alguma palavra da lista |
| `PALAVRAS_CENSURADAS` | Array editável com as palavras bloqueadas — adicionar/remover aqui para ajustar o filtro |

---

## 5. Roteamento — Sistema de Modos (`AppMode`)

O projeto **não usa React Router**. A navegação é controlada por um estado `mode` no componente `AppContent` dentro de `App.tsx`, persistido no `sessionStorage` para sobreviver a recargas.

### Modos disponíveis

| `AppMode` | Tela renderizada |
|-----------|-----------------|
| `home` | `Home` — listagem de itens |
| `details` | `DetalhesItem` — detalhe de um item específico |
| `announce` | `CadastrarItem` — criar anúncio |
| `edit-item` | `EditarItem` — editar anúncio |
| `my-announcements` | `MeusAnuncios` — meus anúncios |
| `perfil` | `Perfil` — perfil do usuário |
| `editar-perfil` | `EditarPerfil` — editar perfil |
| `dashboard` | `Dashboard` — estatísticas |
| `chat` | `Chat` — solicitações + chat em tempo real |

### Hierarquia de renderização (`App.tsx`)

```
App
└── AuthProvider
    └── AppContent
        ├── [loading]         → spinner
        ├── [perfil incompleto] → CompletarPerfil
        ├── [não autenticado]
        │   ├── login         → Login
        │   ├── register      → Cadastro
        │   ├── forgot-pass   → RecuperarSenha
        │   └── update-pass   → RedefinirSenha
        ├── [MFA pendente]    → MfaChallenge
        └── [autenticado]
            ├── renderContent() → página atual
            └── BottomNav
```

---

## 6. Telas e Funcionalidades

### 6.1 `Login.tsx`
- Login com **e-mail + senha** via `supabase.auth.signInWithPassword()`
- Login com **Google OAuth** via `supabase.auth.signInWithOAuth({ provider: 'google' })`
- Tratamento de erros: e-mail não confirmado, credenciais inválidas
- Link para cadastro e recuperação de senha

### 6.2 `Cadastro.tsx`
Formulário completo com validação em múltiplas etapas:

1. **Campos obrigatórios:** nome, e-mail, CPF, data de nascimento, telefone, gênero, endereço completo, senha
2. **Validações front-end:** formato de e-mail (regex), CPF (algoritmo de dígitos verificadores), DDD válido, telefone com 9 inicial, CEP com 8 dígitos, senha ≥ 6 chars + 1 maiúscula + 1 número
3. **Validações via API:**
   - [Disify](https://disify.com/) — verifica DNS do domínio e bloqueia e-mails descartáveis
   - ViaCEP — preenche automaticamente rua, bairro, cidade e UF ao digitar o CEP
4. **Validações no banco:** e-mail duplicado, telefone duplicado, CPF duplicado
5. **Criação da conta:** `supabase.auth.signUp()` → insere linha na tabela `users`
6. **Caso de identidade vazia** (e-mail já existe mas sem perfil): chama `cleanup_orphaned_auth_user` e tenta novamente

### 6.3 `CompletarPerfil.tsx`
Exibida automaticamente quando o usuário autenticou via **Google** mas ainda **não possui um registro em `users`** (verificado por `!profile || !profile.cpf`).

- Pré-preenche nome e e-mail com dados do Google (`user_metadata`)
- Valida CPF, telefone, CEP e data de nascimento
- Faz `upsert` em `users` usando `auth_id` como chave de conflito
- Ao final chama `refreshProfile()` do contexto

### 6.4 `RecuperarSenha.tsx` e `RedefinirSenha.tsx`
- **RecuperarSenha:** verifica se o e-mail existe em `users`, depois chama `supabase.auth.resetPasswordForEmail()`
- **RedefinirSenha:** ativada pelo evento `PASSWORD_RECOVERY` detectado em `onAuthStateChange`. Permite definir nova senha via `supabase.auth.updateUser()`. Após sucesso, faz `signOut()` e redireciona para login.

### 6.5 `Home.tsx` — Listagem de itens
Página principal, acessível após login.

**Filtros disponíveis:**
- Busca por texto (nome ou descrição) — `ilike`
- Categoria
- Período de preço: diário / semanal / mensal
- Faixa de preço (mínimo e máximo)
- Data de anúncio (range `created_at`)
- Ordenação: mais recente, menor preço, maior preço, A-Z
- Filtro de proximidade por raio (1 / 3 / 5 / 10 km) usando geolocalização do navegador

**Funcionamento:**
1. Consulta `item` com join `categoria` e filtro `disponivel != false` (exclui itens em aluguel ativo)
2. Consulta `fotoitem` e associa a foto principal a cada item
3. Exibe cards em grid responsivo (1/2/4 colunas)
4. Persiste todos os filtros no `sessionStorage` para manter estado ao navegar

**Sino de notificações (locador):** abre painel com solicitações pendentes e botões "Recusar" / "Confirmar" sem precisar abrir o Chat. Badge vermelho indica a contagem de pendentes.

### 6.6 `DetalhesItem.tsx` — Detalhes do item

Dividido em 3 abas:

| Aba | Conteúdo |
|-----|---------|
| **Visão Geral** | Fotos (carrossel), preços com desconto visual, info do proprietário, avaliação média, adicionais |
| **Indisponibilidade** | Calendário mensal (somente leitura) com dias indisponíveis em vermelho |
| **Regras** | 5 regras fixas de uso |

**Barra inferior:**
- Se o usuário é o dono: exibe "Você é o proprietário"
- Se `item.disponivel === false`: exibe "Item indisponível" (vermelho) — impede novo aluguel enquanto há um ativo
- Caso contrário: botão "Alugar" abre o modal de solicitação

**Fluxo de solicitação de aluguel:**
1. Usuário clica em "Alugar"
2. Modal com campos: data início, data fim, observações
3. Validação: datas preenchidas, fim > início, nenhuma data indisponível no range
4. Cálculo: `dias × valor_aluguel_diario`
5. Insere em `solicitacao_aluguel` com `status = 'pendente'`

### 6.7 `CadastrarItem.tsx` — Criar anúncio

**Seções do formulário:**
- **Fotos:** upload múltiplo, reordenação por drag-and-drop, primeira foto = capa
- **Informações:** título, categoria, estado do item (Novo/Seminovo/Usado), descrição. Para categoria "Outros", exige um subtipo livre (prefixado como `[subtipo]` na descrição)
- **Preços:** diária obrigatória; semanal e mensal calculados automaticamente com desconto configurável (padrão 10% e 20%)
- **Indisponibilidade:** calendário interativo + regras recorrentes por dia da semana
- **Adicionais:** checkboxes (Entrega incluída, Retirada, Manual, Acessórios, Instalação, Embalagem original)

**Processo de publicação:**
1. Valida campos obrigatórios e pelo menos 1 foto
2. Geocodifica o endereço do locador via Nominatim para salvar `latitude` e `longitude`
3. Insere em `item` com todos os dados
4. Faz upload de cada foto para o bucket `items` do Supabase Storage
5. Insere uma linha em `fotoitem` por foto com a URL pública e `ordem_exibicao`

### 6.8 `EditarItem.tsx`
Idêntico ao `CadastrarItem`, porém:
- Carrega dados existentes ao montar
- Substitui INSERT por UPDATE em `item`
- Gerencia fotos existentes: mantém, remove ou adiciona
- Verifica que o usuário logado é o dono do item antes de salvar

### 6.9 `MeusAnuncios.tsx`
- Lista todos os itens onde `idlocador = user.id` (UUID do Auth)
- Ações por card: **Ver Detalhes**, **Editar**, **Excluir**
- Exclusão: remove primeiro de `fotoitem` (FK), depois de `item`

### 6.10 `Perfil.tsx`
Perfil completo com 3 abas:

**Aba Informações:**
- Exibe: e-mail (com badge verificado/pendente), telefone, CPF (descriptografado na exibição), data de nascimento, gênero, endereço completo
- Stats dinâmicos: avaliação média, total de aluguéis como locatário, total de itens anunciados

**Aba Segurança:**
- **Alterar senha:** re-autentica com senha atual (`signInWithPassword`), depois atualiza via `updateUser`
- **MFA (TOTP):** enroll com QR Code via `supabase.auth.mfa.enroll()`, verificação do código de 6 dígitos, unenroll com confirmação
- **Deletar conta:** modal com senha (ou sem, para usuários OAuth), chama `delete_user_account` via RPC

**Aba Pagamentos:** placeholder (nenhum cartão implementado ainda)

### 6.11 `EditarPerfil.tsx`
- Formulário pré-preenchido com dados do perfil atual
- Permite editar: nome, CPF, telefone, data de nascimento, gênero, endereço (com ViaCEP), avatar
- Upload de avatar: envia para o bucket Supabase com path `avatars/{auth_id}`
- Após salvar: chama `refreshProfile()` do contexto

### 6.12 `Dashboard.tsx`
Painel de estatísticas com alternância entre visão **Locador** e **Locatário**.

**Visão Locador — KPIs:**
- Faturamento total e do ano selecionado
- Total de itens anunciados
- Total de aluguéis / Pendentes / Aprovados / Concluídos / Rejeitados
- Média de dias por aluguel / Ticket médio / Avaliação média / Taxa de aprovação (%)

**Visão Locatário — KPIs:**
- Total gasto / gasto no ano
- Aluguéis realizados, média de dias, gasto médio, contagem por status

**Gráficos:** barras mensais (SVG puro), ranking de categorias, tabela anual

**Painéis de notificação:**
- Locador: aviso de solicitações pendentes com link "Ver no Chat"
- Locatário: aviso de solicitações em andamento com status atual

### 6.13 `Chat.tsx` — Chat de solicitações

Central de comunicação entre locador e locatário vinculada a cada solicitação de aluguel.

#### Lista de conversas
- Exibe todas as `solicitacao_aluguel` do usuário (como locador ou locatário), ordenadas pelo ID
- Badge vermelho no avatar quando há ação pendente:
  - Locador: status `pendente` (precisa aceitar/rejeitar) ou `aprovado` (precisa fotografar o item)
  - Locatário: status `aguardando_entrega` (precisa confirmar recebimento)
- Status colorido por conversa: Pendente (amarelo), Aprovado (azul), Ag. Entrega (laranja), Em Andamento (índigo), Concluído (verde), Rejeitado (vermelho), Cancelado (cinza)

#### Tela de conversa (detalhe)
Exibe o card da solicitação no topo, seguido pelas mensagens em balões, com input habilitado na parte inferior.

**Ações por status (card de solicitação):**

| Status | Visão Locador | Visão Locatário |
|--------|--------------|-----------------|
| `pendente` | Botões "Rejeitar" / "Aceitar" | "Aguardando resposta..." + "Cancelar Solicitação" |
| `aprovado` | "Fotografar Estado do Item" (abre modal de upload) | "Aguardando locador registrar estado do item" |
| `aguardando_entrega` | Foto registrada + "Aguardando confirmação" | Foto antes da entrega + "Confirmar Recebimento" (abre modal) |
| `em_andamento` | Fotos de antes e recebimento + data prevista | Foto de antes + data prevista + botão "↩ Devolver Item" |
| `concluido` | "Aluguel Concluído" | "Aluguel Concluído" |
| `rejeitado` | "Solicitação Rejeitada" | "Solicitação Rejeitada" |
| `cancelado` | "Solicitação Cancelada" | "Solicitação Cancelada" |

**Modal de upload de foto:**
- Aparece centralizado na tela ao fotografar estado ou confirmar recebimento
- Input `type="file" accept="image/*" capture="environment"` — abre câmera no mobile
- Preview da imagem selecionada antes de confirmar
- Foto enviada ao Supabase Storage (bucket `items`, pasta `rental/`)
- URL salva em `foto_antes_url` ou `foto_recebimento_url` da solicitação

#### Mensagens em tempo real
- Carrega o histórico de mensagens da tabela `mensagem` ao abrir a conversa
- Subscrição Supabase Realtime via `postgres_changes` — mensagens chegam sem recarregar a página
- Censura automática: `censurarTexto()` substitui palavras proibidas por `*` antes do INSERT
- Chat habilitado para status ativos (`pendente`, `aprovado`, `aguardando_entrega`, `em_andamento`)
- Chat desabilitado (input bloqueado) para status terminais (`concluido`, `cancelado`, `rejeitado`)
- Auto-scroll para a última mensagem ao receber novas

---

## 7. Componente de Navegação — `BottomNav.tsx`

Barra fixa na parte inferior da tela, visível apenas para usuários autenticados.

| Ícone | Label | Modo ativado |
|-------|-------|-------------|
| Home | Início | `home` |
| PlusCircle | Meus Anúncios | `my-announcements`, `edit-item`, `announce` |
| BarChart2 | Dashboard | `dashboard` |
| MessageSquare | Chat | `chat` |
| User | Perfil | `perfil`, `editar-perfil` |
| LogOut | Sair | Chama `signOut()` |

**Badge de notificação:** ícone do Chat exibe um badge vermelho com a contagem de solicitações `status = 'pendente'` onde o usuário é locador. Atualizado a cada troca de aba.

---

## 8. Segurança e MFA

### MFA (Multi-Factor Authentication)
O sistema usa **TOTP via Supabase Auth** (Google Authenticator / Authy).

**Fluxo de ativação:**
1. Usuário acessa Perfil → Segurança → "Verificação em Duas Etapas"
2. `supabase.auth.mfa.enroll({ factorType: 'totp' })` gera QR Code (SVG data URI)
3. Usuário escaneia e digita o código de 6 dígitos
4. `challenge()` + `verify()` confirmam o fator → status muda para `verified`

**Fluxo de verificação no login:**
No `App.tsx`, após cada login detectado:
1. `mfa.getAuthenticatorAssuranceLevel()` verifica se `nextLevel === 'aal2'` e é diferente do `currentLevel`
2. Se necessário, chama `mfa.listFactors()`, seleciona o fator TOTP verificado e cria um `challenge`
3. Renderiza `MfaChallenge` bloqueando o acesso ao app até a verificação ser concluída

---

## 9. Variáveis de Ambiente

```env
REACT_APP_SUPABASE_URL=https://<projeto>.supabase.co
REACT_APP_SUPABASE_TOKEN=<anon-public-key>
REACT_APP_ENCRYPTION_KEY=<chave-secreta-para-AES>
```

---

## 10. Fluxos Completos

### 10.1 Cadastro de novo usuário (e-mail)
```
Usuário preenche form
→ Validação front-end (CPF, telefone, CEP, senha, e-mail)
→ Verifica DNS do e-mail (Disify)
→ Verifica duplicidade de e-mail e telefone no banco
→ supabase.auth.signUp() → cria em auth.users
→ supabase.from('users').insert() → cria perfil
→ Exibe mensagem: "Confirme seu e-mail"
→ (5s) redireciona para Login
```

### 10.2 Cadastro via Google OAuth
```
Clica "Continuar com Google"
→ supabase.auth.signInWithOAuth({ provider: 'google' })
→ Supabase redireciona para Google → volta ao app
→ AuthContext detecta SIGNED_IN
→ fetchProfile: não encontra registro em users (!profile.cpf)
→ App renderiza CompletarPerfil
→ Usuário preenche dados complementares
→ supabase.from('users').upsert()
→ refreshProfile() → app libera acesso
```

### 10.3 Solicitar aluguel de um item
```
Home → clica "Ver Detalhes"
→ DetalhesItem verifica item.disponivel
  → FALSE: exibe "Item indisponível" (bloqueia aluguel)
  → TRUE: exibe botão "Alugar"
→ Modal: seleciona data início e fim
→ Valida se período não contém datas indisponíveis
→ Calcula total: dias × valor_aluguel_diario
→ supabase.from('solicitacao_aluguel').insert({ status: 'pendente' })
→ Locador recebe badge no BottomNav e sino na Home
```

### 10.4 Fluxo completo de aluguel (máquina de estados)
```
[pendente]
  Locador: Aceitar
  → UPDATE status = 'aprovado'
  → Trigger: item.disponivel = FALSE
  → Item some da listagem da Home

[aprovado]
  Locador: Fotografar estado do item
  → Upload foto → Storage bucket items/rental/
  → UPDATE foto_antes_url + status = 'aguardando_entrega'

[aguardando_entrega]
  Locatário: Confirmar recebimento com foto
  → Upload foto → Storage bucket items/rental/
  → UPDATE foto_recebimento_url + status = 'em_andamento'

[em_andamento]
  Locatário: Devolver item
  → UPDATE status = 'concluido'
  → Trigger: item.disponivel = TRUE
  → Item volta a aparecer na listagem da Home

[concluido] — estado terminal
```

### 10.5 Chat em tempo real
```
Usuário abre conversa no Chat
→ SELECT mensagem WHERE idsolicitacao = X ORDER BY criado_em
→ Subscrição Realtime: postgres_changes INSERT na tabela mensagem
→ Usuário digita mensagem → Enter ou botão Send
→ censurarTexto() substitui palavras proibidas
→ INSERT INTO mensagem (idsolicitacao, idremetente, conteudo)
→ Realtime entrega para o outro participante sem reload
→ Auto-scroll para a última mensagem
```

---

## 11. Funcionalidades Não Implementadas / Placeholders

| Funcionalidade | Status |
|----------------|--------|
| Pagamentos / cadastro de cartão | Placeholder (aba "Pagamentos" no Perfil) |
| Histórico de Aluguéis | Botão existe, sem ação |
| Central de Ajuda | Botão existe, sem ação |
| Notificações push | Não implementado |
| Avaliação pós-aluguel (criação) | Tabela existe, leitura funciona, formulário não existe |

---

## 12. Deploy

O projeto é publicado na **Vercel**. O arquivo `vercel.json` configura redirecionamento de todas as rotas para `index.html` (necessário para SPA sem React Router).

```json
// vercel.json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

As variáveis de ambiente de produção (`REACT_APP_*`) devem ser configuradas no painel da Vercel.
