# Guia de Inicialização e Uso do AlugApp

Bem-vindo ao **AlugApp**, uma aplicação web para aluguel de itens entre moradores. Este guia explica como configurar, iniciar e utilizar o aplicativo de maneira correta e fluida.

## Inicializando o Aplicativo

### 1. Abra o Projeto no VS Code
Abra o VS Code e selecione "File > Open Folder" para abrir a pasta do projeto.

### 2. Inicie o Live Server
- Clique com o botão direito no arquivo `index.html` no explorador de arquivos do VS Code
- Selecione "Open with Live Server"
- O navegador abrirá automaticamente em `http://localhost:5500/index.html` (a porta pode variar)

> **⚠️ Nota Importante**: O aplicativo deve ser executado por meio de um servidor local (como o Live Server) porque utiliza requisições fetch para carregar as telas dinamicamente. Abrir o `index.html` diretamente no navegador (protocolo `file://`) causará erros.

## Como Utilizar o AlugApp

### 1. Tela de Login

**Acesso Inicial**: Ao abrir o aplicativo, você será direcionado à tela de login automaticamente, a menos que já esteja logado.

**Funcionalidades**:
- **Entrar**: Digite qualquer e-mail e senha (simulação, sem necessidade de credenciais reais) e clique em **ENTRAR** para acessar a tela principal
- **Criar Conta**: Clique em **CRIAR CONTA** para ir à tela de cadastro
- **Login com Redes Sociais**: Botões de login com Facebook, Google e Apple estão disponíveis, mas exibem uma mensagem de simulação
- **Esqueceu a Senha**: Clique em "Esqueceu a senha?" para ver uma mensagem de simulação de recuperação

> **💡 Dica**: Ative a opção "Lembrar minha conta" para manter a sessão (salva no localStorage).

### 2. Tela de Cadastro

**Acesso**: Acesse a partir da tela de login clicando em **CRIAR CONTA**.

**Funcionalidades**:
- Preencha todos os campos obrigatórios:
  - Nome Completo
  - E-mail
  - CPF (formato: `123.456.789-01`, formatado automaticamente ao digitar)
  - Data de Nascimento
  - Estado (selecione no menu suspenso)
  - Cidade
  - Endereço
  - Senha (mínimo 6 caracteres)
  - Confirmar Senha
- Clique em **CADASTRAR** para salvar os dados (simulação) e voltar à tela de login
- **Validação**: Campos obrigatórios são validados em tempo real (campos vazios ficam com borda vermelha). O CPF deve estar no formato correto, e as senhas devem coincidir

### 3. Tela Principal

**Acesso**: Após o login, você será levado à tela principal, que contém:
- **Cabeçalho**: Logotipo e botão Anunciar Item
- **Categorias**: Ferramentas, Esportes, Eletrônicos e Outros. Clique para filtrar itens
- **Itens Disponíveis**: Lista de itens disponíveis para aluguel, com imagem, título, preço, descrição e localização
- **Barra de Navegação Inferior**: Ícones para Início, Buscar, Meus Anúncios, Chat e Perfil

### 4. Anunciar um Item

**Acesso**: Na tela principal, clique em **Anunciar Item** no cabeçalho.

**Funcionalidades**:
- Preencha o formulário com:
  - Título do item
  - Categoria (selecione no menu suspenso)
  - Preço por dia (ex.: R$ 15/dia)
  - Localização (ex.: Asa Norte - Bloco A)
  - Descrição
  - Imagem (opcional, aceita arquivos de imagem)
- Clique em **Publicar Anúncio**. Após 1 segundo (loading), o item será salvo e aparecerá na aba Meus Anúncios
- Clique em **Cancelar** ou fora do formulário para fechar sem salvar

> **📝 Nota**: Os anúncios são salvos no localStorage e persistem até que o localStorage seja limpo.

### 5. Aba "Meus Anúncios"

**Acesso**: Clique no ícone 📢 na barra inferior.

**Funcionalidades**:
- Exibe todos os itens que você anunciou
- Se não houver anúncios, mostra um botão **Criar Primeiro Anúncio** que abre o formulário de anúncio
- Cada item é exibido como um card com imagem (ou ícone da categoria se não houver imagem), título, preço, descrição e localização
- Clique em **Ver Detalhes** para ver informações completas do item (simulação)

### 6. Aba "Buscar"

**Acesso**: Clique no ícone 🔍 na barra inferior.

**Funcionalidades**:
- Digite um termo no campo de busca para filtrar itens por título, descrição ou categoria
- Clique nos botões de categoria (Ferramentas, Esportes, Eletrônicos, Outros) para filtrar por categoria
- Pressione Enter ou clique em **Buscar** para executar a pesquisa
- Os resultados incluem itens padrão e seus próprios anúncios (de "Meus Anúncios")

### 7. Aba "Chat"

**Acesso**: Clique no ícone 💬 na barra inferior.

**Funcionalidades**: Exibe uma mensagem de simulação indicando que não há conversas iniciadas. Em uma versão completa, mostraria mensagens relacionadas a itens alugados.

### 8. Aba "Perfil"

**Acesso**: Clique no ícone 👤 na barra inferior.

**Funcionalidades**:
- Mostra informações do usuário (nome extraído do e-mail, e-mail, data de cadastro)
- Exibe estatísticas: Itens Alugados (0), Itens Anunciados (quantidade de anúncios criados) e Avaliação (fixa em 5.0)
- **Opções de configuração**:
  - **Editar Perfil**: Simulação (exibe mensagem)
  - **Notificações**: Simulação (exibe mensagem)
  - **Ajuda**: Simulação (exibe mensagem)
  - **Sair**: Faz logout imediato (com loading de 1 segundo) e retorna à tela de login

### 9. Sair do Aplicativo

Na aba Perfil, clique em **Sair** para fazer logout. Não há confirmação, e você será levado à tela de login após 1 segundo.

## Dicas para uma Experiência Fluida

- **Use um Servidor Local**: Sempre inicie o aplicativo com o Live Server ou outro servidor web para evitar erros de carregamento
- **Preencha Campos Corretamente**: No cadastro, use o formato correto para o CPF (`123.456.789-01`). No formulário de anúncio, preencha todos os campos obrigatórios
- **Navegação Rápida**: Use a barra inferior para alternar entre as abas. As transições de tela são suaves, com animações de opacidade
- **Persistência de Dados**: Anúncios e informações de login são salvos no localStorage. Para resetar, limpe o localStorage no console do navegador:
  ```javascript
  localStorage.clear();
  ```
- **Teste com Imagens**: Ao anunciar itens, experimente adicionar imagens para ver como aparecem nos cards. Sem imagem, um ícone da categoria será exibido
- **Validação em Tempo Real**: Campos vazios ou inválidos são destacados com borda vermelha. Corrija antes de enviar formulários

## Solução de Problemas

### Tela em branco ou não carrega
- Verifique se está usando o Live Server (acessando `http://localhost:5500/index.html`)
- Abra o console do navegador (F12, aba "Console") e procure por erros como "Failed to fetch". Isso indica que os arquivos HTML ou CSS não foram encontrados. Confirme que todos estão na mesma pasta

### Anúncios não aparecem em "Meus Anúncios"
- Certifique-se de que o formulário de anúncio foi preenchido corretamente e enviado
- Verifique o console para erros relacionados ao localStorage

### Imagens não carregam
- Se uma imagem não for fornecida no anúncio, um placeholder ou ícone da categoria será usado
- Certifique-se de que a imagem enviada é válida (formatos como JPG ou PNG)

### Funcionalidades não respondem
- Confirme que o `app.js` está carregado corretamente (verifique o `<script src="app.js">` em `index.html`)
- Veja o console para erros de JavaScript

## Notas Adicionais

- **Estilos**: O aplicativo segue o design do Figma, com cores, fontes e layouts consistentes
- **Simulações**: Algumas funcionalidades (login social, recuperação de senha, chat, edição de perfil, notificações, ajuda) são simuladas com mensagens de alerta, pois são apenas protótipos
- **Persistência**: Anúncios e dados de login persistem no localStorage até serem limpos manualmente

- Link para O Diagrama https://miro.com/app/board/uXjVJE_hl-c=/?share_link_id=668612464362