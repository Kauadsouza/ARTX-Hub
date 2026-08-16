# ARTX Hub

Seu painel privado de projetos, notas e tarefas. Site, Vídeos, SAT, University
Path e Condor continuam sistemas independentes; o Hub organiza o acesso sem
misturar código, banco ou identidade de cada projeto.

## Build local atual

```powershell
npm.cmd install
$env:CONDOR_LOCAL_BUILD = "1"
npm.cmd run build
```

O resultado fica em `out/` e pode ser servido pelo Condor em
`http://127.0.0.1:7777/hub/index.html`. Sem essa variável, o projeto mantém o
build normal do ARTX Hub.

## Configuração inicial

1. Crie um projeto no Supabase.
2. Em **Authentication > Users**, crie manualmente seu único usuário com e-mail e senha. Não habilite cadastro público.
3. Abra o **SQL Editor** e execute `supabase/schema.sql`.
4. Copie `.env.example` para `.env.local` e complete a URL e a chave pública do Supabase. Preencha também as URLs publicadas do Sistema de Vídeos e SAT quando estiverem disponíveis.
5. Instale e rode:

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Publicar como aplicativo

Publique este projeto na Vercel e abra a URL no Chrome/Edge (PC) ou Safari/Chrome (celular). Use **Instalar aplicativo** / **Adicionar à Tela de Início**. O Hub já inclui o manifesto PWA e abre sem a barra normal do navegador depois de instalado.

## Segurança de publicação

- Mantenha o repositório privado e nunca versione `.env.local` ou `.vercel/`.
- Use somente a chave pública/publishable do Supabase no frontend. Nunca use a
  chave `service_role` no Hub.
- Desative novos cadastros em **Authentication > Sign In / Providers > User
  Signups** depois de criar o usuário proprietário.
- Aplique `supabase/schema.sql`: as tabelas usam RLS por proprietário e removem
  acesso do papel anônimo.
- A publicação inclui CSP, HSTS, bloqueio de iframe, política de permissões,
  `no-referrer` e `noindex`.
- Ative a proteção de deployments e de forks Git no projeto Vercel. A URL de
  produção continua exigindo a autenticação do próprio Hub.

## Projetos conectados

O Hub não mistura os bancos ou o código dos outros sistemas. Ele os abre como sistemas próprios em uma nova aba/tela, mantendo logins e dados seguros. As URLs são configuradas em `.env.local`.
