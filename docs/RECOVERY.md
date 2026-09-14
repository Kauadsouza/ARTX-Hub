# Usar o Hub em outro computador

## Baixar e entrar

1. Abra [as versões oficiais do ARTX Hub](https://github.com/Kauadsouza/ARTX-Hub/releases/latest).
2. No Windows 10/11 de 64 bits, baixe o arquivo `ARTX-Hub-Setup-1.0.0-x64.exe` e instale.
3. Entre com a mesma conta usada no [site](https://artx-hub.vercel.app). Criar outra conta cria outro espaço.
4. Abra cada sistema e aguarde a confirmação de sincronização. Em caso de conflito, exporte a cópia local antes de resolver; não apague os dados do navegador.

O site continua disponível se você não puder instalar o aplicativo. Ele requer internet. No Android/iPhone, use o site ou a opção de instalar/adicionar à tela inicial do navegador; este instalador EXE é exclusivo do Windows.

## O que o login recupera

| Conteúdo | Onde fica | Recuperação |
| --- | --- | --- |
| Notas, atividades e cursos do Hub | Banco do Hub, por conta | Mesmo login; aguardar sincronização |
| Vídeos, roteiros e checklists | Banco do Video Studio | Abrir o estúdio com a mesma conta |
| Progresso de estudos | IndexedDB e sincronização de conta | Mesmo perfil/conta; confirmar que houve envio antes de perder o dispositivo |
| Planejamento universitário | Dados locais e sincronização de conta | Mesmo login; confirmar sincronização |
| Documentos e certificados enviados | Supabase Storage privado | Mesmo login, desde que o upload tenha sido concluído |
| Memória, identidade e configurações locais do Condor | Pasta privada `.condor` no PC | Backup próprio dessa pasta e a frase secreta original |
| Código dos seis sistemas | Repositórios GitHub independentes | Clonar ou baixar o repositório correspondente |

**O login recupera o que foi sincronizado. Arquivos que ficaram apenas no PC não aparecem automaticamente em outro dispositivo.** Este instalador não cria um backup da memória local do Condor nem transforma o GitHub em banco de dados pessoal.

## Contas e privacidade

Mantenha acesso ao e-mail de recuperação do Hub e à sua conta GitHub. Ative autenticação em dois fatores e guarde os códigos de recuperação em local seguro. Para a conta proprietária por e-mail, use “Esqueci minha senha” no Hub quando necessário. Contas de membros dependem da aprovação e recuperação pelo proprietário.

O código e o instalador podem ser públicos sem incluir os dados privados. A proteção dos dados depende de autenticação, permissões por conta, RLS e segurança dos serviços. Tornar um repositório privado não substitui esses controles e não remove cópias já feitas por outras pessoas.

## Recuperar a infraestrutura

Repositórios:

- [ARTX Hub](https://github.com/Kauadsouza/ARTX-Hub)
- [Video Studio](https://github.com/Kauadsouza/KauaArtx-Video-Studio)
- [SAT & English Learning](https://github.com/Kauadsouza/SAT-simulado)
- [University Path — acesso privado](https://github.com/Kauadsouza/University-Path)
- [Site KauaArtx](https://github.com/Kauadsouza/Site-KauaArtx)
- [Condor](https://github.com/Kauadsouza/Condor-Ai)

O GitHub guarda código, migrações, documentação e instaladores publicados. Os projetos Vercel e Supabase pertencem às respectivas contas e continuam existindo quando o PC é perdido. Variáveis secretas ficam nos serviços e não devem ser publicadas no código. A perda também dessas contas exige um plano adicional de backup da infraestrutura.

Backups do banco Supabase não incluem os arquivos de Storage; um backup completo do serviço precisa dos dois. Consulte a [documentação de backups](https://supabase.com/docs/guides/platform/backups). Nenhum procedimento de restauração integral do banco/Storage foi executado por este instalador.

## Verificar o instalador

Baixe também `SHA256SUMS.txt` da mesma versão e compare com:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath .\ARTX-Hub-Setup-1.0.0-x64.exe
```

Com o GitHub CLI, a procedência de um artefato publicado pelo workflow pode ser verificada com:

```powershell
gh attestation verify .\ARTX-Hub-Setup-1.0.0-x64.exe --repo Kauadsouza/ARTX-Hub
```

A assinatura Authenticode do editor ainda não está configurada. A verificação de origem do GitHub e o checksum não substituem esse certificado.
