# ARTX Hub

[English](README.md) · **Português** · [Español](README.es.md)

A central privada que reúne os sistemas do Kauã — produção de vídeo, estudo de idiomas, planejamento universitário, site público e o assistente local — numa interface só, **sem fundir os códigos, os bancos nem as fronteiras de segurança deles**.

[Abrir o Hub](https://artx-hub.vercel.app) · [Baixar para Windows](https://github.com/Kauadsouza/ARTX-Hub/releases/latest) · Requer autenticação

---

## Por que ele existe

Cinco sistemas separados viram cinco abas esquecidas, cinco logins e cinco lugares onde uma tarefa pode se perder. Juntar tudo num monolito resolveria isso e criaria um problema pior: um bug no estúdio de vídeo derrubaria os estudos junto.

O Hub é uma **camada de orquestração**. Cada produto continua com deploy próprio, banco próprio e ciclo de vida próprio; o Hub dá a eles uma porta comum e uma sessão comum.

## O que ele conecta

| Sistema | Para que serve | Como se integra |
| --- | --- | --- |
| [Site KauaArtx](https://github.com/Kauadsouza/Site-KauaArtx) | Presença pública bilíngue e marca pessoal | Aplicação externa |
| [Video Studio](https://github.com/Kauadsouza/KauaArtx-Video-Studio) | Ideias, roteiros e publicação no YouTube | Embutida, com sessão do Hub |
| [Idiomas](https://github.com/Kauadsouza/SAT-simulado) | Inglês e espanhol: estudo diário e provas | Embutida, com sessão do Hub |
| [University Path](https://github.com/Kauadsouza/University-Path) | Candidatura a universidades no Reino Unido | Embutida, com sessão do Hub |

## Aplicativo para Windows

O instalador sai das releases oficiais e usa a **mesma conta** do site — não existe segunda senha. Ele não carrega dado privado nem credencial: é uma casca Electron que abre o Hub hospedado, então qualquer mudança no site aparece sem reinstalar.

A partir da versão 1.0.1 ele **se atualiza sozinho**: verifica a release do GitHub, baixa em segundo plano e pergunta antes de reiniciar — nunca interrompe quem está no meio de algo. Isso importa porque o conteúdo do Hub se renova sozinho, mas o Electron em volta não: sem esse canal, uma correção de segurança só chegaria se alguém reinstalasse à mão.

Veja [instalação e segurança do desktop](desktop/README.md) e [como recuperar o acesso em outro PC](docs/RECOVERY.md).

## Controle de acesso

O proprietário entra pela conta Supabase. Outras pessoas criam conta e ficam **pendentes até aprovação** — e a aprovação é por sistema: dá para liberar só Vídeos, só Idiomas, ou o que fizer sentido. Nada é liberado por padrão, e os dados de cada conta ficam separados.

## Decisões técnicas que valem menção

- **Orquestração, não monolito.** Cada sistema embutido recebe a sessão por `postMessage` com origem verificada, em vez de compartilhar banco.
- **Row Level Security escopada ao dono**, cobrindo inclusive os arquivos no Storage — não só as tabelas.
- **Nenhuma credencial de serviço no navegador.** Só URL e chave publicável do Supabase chegam ao cliente.
- **Electron endurecido:** sandbox, isolamento de contexto e fuses desligando `runAsNode`, inspeção por CLI e carregamento fora do asar.
- **Release com procedência.** A build confere se a tag bate com a versão, gera SHA256SUMS e emite atestado de proveniência do GitHub. O instalador ainda não tem assinatura Authenticode — isso está declarado na própria release, não escondido.
- **Recuperação documentada e honesta**, incluindo o que o login *não* traz de volta.

## Tecnologias

Next.js 16, React 19, TypeScript, Supabase Auth/PostgreSQL, Electron e Vercel.

## Desenvolvimento local

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run dev
```

Configuração pública necessária:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_VIDEOS_URL
NEXT_PUBLIC_SAT_URL
```

Só valores públicos do Supabase entram em variáveis do navegador. Nunca use uma chave `service_role` nesta aplicação.

Opcional: `ANTHROPIC_API_KEY` habilita a Jade, a inteligência do Hub. Sem ela, a aba explica que ainda não foi configurada e o resto segue funcionando.

## Verificação

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd audit --omit=dev
```

## Mapa do repositório

```text
desktop/          Aplicativo Electron e sua cadeia de release
docs/             Recuperação de acesso e procedimentos
src/app/          Shell da aplicação, rotas e estilos globais
src/components/   Hub, painéis e áreas de trabalho dos sistemas
src/lib/          Registro de projetos, cliente Supabase e dados comuns
supabase/         Políticas de banco e de armazenamento por dono
tests/            Verificações de comportamento e integração
```

## Situação

Infraestrutura pessoal em uso. O código é público para quem quiser revisar; o Hub publicado e os dados dele são privados por desenho.

Feito e mantido por [Kauã Diniz Souza](https://github.com/Kauadsouza).
