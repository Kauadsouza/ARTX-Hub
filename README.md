# ARTX Hub

Seu painel privado: projetos, notas e tarefas sincronizadas entre computador e celular.

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

## Projetos conectados

O Hub não mistura os bancos ou o código dos outros sistemas. Ele os abre como sistemas próprios em uma nova aba/tela, mantendo logins e dados seguros. As URLs são configuradas em `.env.local`.
