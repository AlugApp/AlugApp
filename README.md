# AlugApp

Aplicação web para aluguel de itens entre moradores de condomínio. Desenvolvida como Projeto Integrador II no Centro Universitário de Brasília (CEUB).

## Tecnologias

- **React 19** + **TypeScript**
- **Tailwind CSS** — estilização
- **Supabase** — banco de dados PostgreSQL e autenticação
- **Lucide React** — ícones
- **Create React App**

## Funcionalidades

- **Login e Cadastro** de moradores
- **Home** com listagem de itens disponíveis, filtros por categoria, preço, período e ordenação
- **Detalhes do Item** com informações completas e solicitação de aluguel
- **Anunciar Item** — cadastro de novos itens com foto, categoria e preços
- **Perfil** com abas de informações pessoais, segurança e pagamentos
- **Editar Perfil** — atualização de dados pessoais integrada ao banco
- **Alterar Senha** com verificação da senha atual
- **Sair da Conta** com encerramento de sessão

## Pré-requisitos

- [Node.js](https://nodejs.org/) (versão 16 ou superior)
- npm (incluso com o Node.js)
- Conta no [Supabase](https://supabase.com/)

## Configuração

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/LucasCarmonaDev/AlugApp.git
   cd AlugApp
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente:**

   Crie um arquivo `.env` na raiz do projeto com as credenciais do Supabase:
   ```env
   REACT_APP_SUPABASE_URL=sua_url_do_supabase
   REACT_APP_SUPABASE_TOKEN=sua_chave_anon_do_supabase
   ```

4. **Inicie o projeto:**
   ```bash
   npm start
   ```

   O app abrirá em `http://localhost:3000`.

## Estrutura de Telas

| Tela | Arquivo |
|------|---------|
| Login | `src/pages/Login.tsx` |
| Cadastro | `src/pages/Cadastro.tsx` |
| Home | `src/pages/Home.tsx` |
| Detalhes do Item | `src/pages/DetalhesItem.tsx` |
| Anunciar Item | `src/pages/CadastrarItem.tsx` |
| Perfil | `src/pages/Perfil.tsx` |
| Editar Perfil | `src/pages/EditarPerfil.tsx` |

## Banco de Dados (Supabase)

Tabelas utilizadas:

- `users` — dados dos moradores (nome, email, CPF, telefone, apartamento, bloco, senha)
- `item` — itens anunciados (nome, descrição, valores por período, categoria, localização)
- `fotoitem` — fotos dos itens
- `categoria` — categorias dos itens

## Scripts Disponíveis

```bash
npm start      # Inicia em modo desenvolvimento
npm run build  # Gera build de produção
npm test       # Executa os testes
```

## Diagrama do Projeto

[Ver diagrama no Miro](https://miro.com/app/board/uXjVJE_hl-c=/?share_link_id=668612464362)
