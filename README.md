# AlugApp

> Plataforma web para aluguel de itens entre moradores de condomínio, desenvolvida como Projeto Integrador II no Centro Universitário de Brasília (CEUB).

## Sobre o Projeto

O **AlugApp** conecta moradores de um mesmo condomínio para que possam alugar itens entre si — como ferramentas, equipamentos esportivos, eletrônicos e outros. O objetivo é promover o compartilhamento dentro da comunidade, reduzindo custos e o desperdício de itens subutilizados.

### Funcionalidades

- Cadastro e login de moradores
- Listagem de itens disponíveis com filtros por categoria, preço e período
- Busca por nome e descrição
- Publicação de itens para aluguel com foto e valores por dia, semana e mês
- Tela de detalhes do item com solicitação de aluguel
- Perfil do morador com informações pessoais, segurança e pagamentos
- Edição de perfil integrada ao banco de dados
- Alteração de senha com verificação da senha atual
- Encerramento de sessão

---

## Tecnologias Utilizadas

| Tecnologia | Finalidade |
|------------|------------|
| React 19 + TypeScript | Interface e lógica do frontend |
| Tailwind CSS | Estilização |
| Supabase (PostgreSQL) | Banco de dados e backend |
| Lucide React | Ícones |
| Create React App | Configuração do projeto |

---

## Instalação e Execução

### Pré-requisitos

- [Node.js](https://nodejs.org/) versão 16 ou superior
- npm (incluso com o Node.js)
- Conta no [Supabase](https://supabase.com/)

### Passo a passo

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

---

## Como Usar

### 1. Login
Acesse com seu e-mail e senha cadastrados. Ative "Lembrar minha conta" para manter a sessão.

### 2. Cadastro
Preencha seus dados pessoais (nome, CPF, e-mail, telefone, apartamento e bloco) para criar sua conta.

### 3. Home
Visualize todos os itens disponíveis para aluguel. Use os filtros de categoria, preço e período para encontrar o que precisa. Clique em **Ver Detalhes** para mais informações.

### 4. Detalhes do Item
Veja a descrição completa, preço, localização e informações do proprietário. Clique em **Alugar** para enviar uma solicitação com as datas desejadas.

### 5. Anunciar Item
Clique em **Anunciar Item** no cabeçalho da Home. Preencha o formulário com título, categoria, descrição, preços e foto do item.

### 6. Perfil
Acesse seu perfil pelo ícone na barra inferior. Visualize e edite suas informações pessoais, altere sua senha ou encerre a sessão.

---

## Estrutura do Projeto

```
src/
├── pages/
│   ├── Login.tsx          # Tela de login
│   ├── Cadastro.tsx       # Tela de cadastro
│   ├── Home.tsx           # Tela principal com listagem de itens
│   ├── DetalhesItem.tsx   # Detalhes de um item específico
│   ├── CadastrarItem.tsx  # Formulário para anunciar item
│   ├── Perfil.tsx         # Perfil do morador
│   └── EditarPerfil.tsx   # Edição de dados do perfil
├── App.tsx                # Controle de navegação entre telas
└── index.css              # Estilos globais
```

### Banco de Dados (Supabase)

| Tabela | Descrição |
|--------|-----------|
| `users` | Dados dos moradores |
| `item` | Itens anunciados |
| `fotoitem` | Fotos dos itens |
| `categoria` | Categorias disponíveis |

---

## Autores

Desenvolvido por estudantes do curso de Ciência da Computação do CEUB:

- **Cauã Paniagua**
- **Lucas Carmona**
- **Mateus Joaquim**
- **Pedro Emílio**

---

## Licença

Este projeto está sob a licença MIT. Isso significa que você pode usar, copiar e modificar o código, desde que mantenha os créditos aos autores originais.

---

## Links

- [Diagrama do Projeto (Miro)](https://miro.com/app/board/uXjVJE_hl-c=/?share_link_id=668612464362)
- [Repositório no GitHub](https://github.com/LucasCarmonaDev/AlugApp)
