import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LIMITE_BYTES, formatoDe, nomeSeguro } from "@/lib/arquivos";
import {
  SISTEMAS,
  SISTEMAS_DE_PESSOA,
  digest,
  hashPassword,
  issueMemberSession,
  matchesPassword,
  memberIdentity,
  requireHubOwner,
  sistema,
  throttle,
} from "@/lib/contas-auth";

/**
 * O serviço de contas.
 *
 * Um endereço só, no Hub, para todos os sistemas. Cada sistema fala com este
 * serviço e com mais nenhum outro — o de vídeos não sabe que o de idiomas
 * existe, e vice-versa. Quem decide quem entra em quê é o dono, aqui.
 *
 * Este arquivo veio do sistema de vídeos, onde o serviço morava. O contrato de
 * rede é o mesmo de lá, de propósito: os sistemas só trocaram o endereço para
 * onde mandam, sem mudar o que mandam — ninguém é deslogado na mudança.
 */

export const runtime = "nodejs";

/* Um endereço a mais aqui é um sistema a mais que pode pedir login. A lista é
   fechada; qualquer outra origem leva 403 antes de o corpo ser lido. */
const permitidas = new Set([
  "https://artx-hub.vercel.app",
  "https://sistema-videos.vercel.app",
  "https://sat-simulado.vercel.app",
  "https://university-path-six.vercel.app",
  "https://cursos-artx.vercel.app",
]);

function cabecalhos(request: Request) {
  const origem = request.headers.get("origin");
  if (origem && origem !== new URL(request.url).origin && !permitidas.has(origem)) {
    throw new Error("Origem não permitida.");
  }
  return {
    "Cache-Control": "no-store",
    Vary: "Origin",
    ...(origem ? { "Access-Control-Allow-Origin": origem } : {}),
  };
}

export function OPTIONS(request: Request) {
  try {
    return new Response(null, {
      status: 204,
      headers: {
        ...cabecalhos(request),
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch {
    return new Response(null, { status: 403 });
  }
}

/** Lê o corpo com teto de tamanho: um pedido gigante não pode virar memória. */
async function ler(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("Envie JSON.");
  const leitor = request.body?.getReader();
  if (!leitor) throw new Error("Pedido vazio.");
  const partes: Uint8Array[] = [];
  let tamanho = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    tamanho += value.length;
    if (tamanho > 2_000_000) {
      await leitor.cancel();
      throw new Error("Pedido muito grande.");
    }
    partes.push(value);
  }
  return JSON.parse(Buffer.concat(partes).toString("utf8")) as Record<string, unknown>;
}

/**
 * A tabela de arquivos existe?
 *
 * Sem esta conferência, a ausência dela aparece como a mensagem genérica de
 * falha — que não diz o que fazer. Com ela, diz.
 */
async function temTabelaDeArquivos(): Promise<boolean> {
  const [linha] = await prisma.$queryRaw<{ existe: string | null }[]>`
    SELECT to_regclass('public."MemberFile"')::text AS existe
  `;
  return Boolean(linha?.existe);
}

const SEM_TABELA = "O lugar de guardar arquivos ainda não foi criado no banco. Rode a migração MemberFile.";

/**
 * Garante a tabela de arquivos, fechada, antes do primeiro uso.
 *
 * O banco é compartilhado com o sistema de vídeos, e nenhum deploy do Hub
 * roda migração; a tabela dependia de alguém colar o SQL no Supabase. Agora
 * o próprio Hub a cria na primeira vez que um arquivo é pedido — os mesmos
 * comandos de prisma/migrations/…_member_files, todos idempotentes. RLS e
 * REVOKE rodam sempre, inclusive numa tabela criada à mão antes: é o que a
 * mantém fora da API pública do Supabase. Uma vez por instância.
 */
let tabelaGarantida: Promise<void> | null = null;
function garantirTabelaDeArquivos(): Promise<void> {
  tabelaGarantida ??= (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public."MemberFile" (
        id TEXT PRIMARY KEY,
        principal TEXT NOT NULL,
        app TEXT NOT NULL CHECK (app IN ('hub', 'videos', 'study', 'university', 'cursos')),
        chave TEXT NOT NULL,
        nome TEXT NOT NULL,
        tipo TEXT NOT NULL,
        tamanho INTEGER NOT NULL,
        conteudo BYTEA NOT NULL,
        "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "MemberFile_principal_app_chave_key" ON public."MemberFile"(principal, app, chave)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MemberFile_principal_app_idx" ON public."MemberFile"(principal, app)`);
    await prisma.$executeRawUnsafe(`ALTER TABLE public."MemberFile" ENABLE ROW LEVEL SECURITY`);
    await prisma.$executeRawUnsafe(`REVOKE ALL ON public."MemberFile" FROM anon, authenticated`);
  })().catch((erro) => {
    // Falhou (sem permissão, banco fora): tenta de novo no próximo pedido.
    tabelaGarantida = null;
    throw erro;
  });
  return tabelaGarantida;
}

export async function POST(request: Request) {
  let headers: Record<string, string>;
  try {
    headers = cabecalhos(request);
  } catch {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  }

  try {
    const body = await ler(request);
    const action = body.action;
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    let result: unknown = { ok: true };

    if (action === "admin-list" || action === "admin-decide" || action === "admin-decide-all" || action === "admin-configure" || action === "admin-delete") {
      await requireHubOwner(token);

      if (action === "admin-list") {
        result = await prisma.memberGrant.findMany({
          select: { app: true, status: true, memberId: true, updatedAt: true, member: { select: { username: true, createdAt: true } } },
          orderBy: { updatedAt: "desc" },
          take: 500,
        });
      } else if (action === "admin-delete") {
        /*
          Apagar de verdade, não esconder.

          As concessões saem por cascata junto da conta, mas sessão e estado
          guardado não: as duas se ligam à pessoa por um texto, não por chave
          estrangeira. Se ficassem, a próxima conta a receber o mesmo id
          herdaria dados de outra pessoa — e uma sessão viva continuaria
          entrando numa conta que já não existe.
        */
        const memberId = String(body.memberId ?? "");
        const conta = await prisma.memberAccount.findUnique({ where: { id: memberId }, select: { id: true } });
        if (!conta) throw new Error("Conta não encontrada.");

        /*
          A tabela de arquivos é conferida antes, e não assumida.

          Ela nasceu com os certificados e é criada à mão enquanto o banco
          ainda mora no sistema de vídeos. Enquanto não existir, qualquer
          comando que a mencione derruba a transação inteira — e foi
          exatamente isso que aconteceu: apagar conta parou de funcionar no
          instante em que o certificado entrou, sem nenhuma relação aparente
          entre as duas coisas.

          Apagar uma conta não pode depender de uma funcionalidade que ela
          nem usa.
        */
        const guardaArquivos = await temTabelaDeArquivos();

        await prisma.$transaction(async (tx) => {
          await tx.memberSession.deleteMany({ where: { principal: memberId } });
          await tx.memberState.deleteMany({ where: { principal: memberId } });
          if (guardaArquivos) await tx.memberFile.deleteMany({ where: { principal: memberId } });
          await tx.memberAccount.delete({ where: { id: memberId } });
        });
      } else if (action === "admin-decide-all" || action === "admin-configure") {
        const memberId = String(body.memberId ?? "");
        const conta = await prisma.memberAccount.findUnique({ where: { id: memberId }, select: { id: true } });
        if (!conta) throw new Error("Conta não encontrada.");

        if (action === "admin-decide-all") {
          if (!["approved", "rejected", "revoked"].includes(String(body.status))) throw new Error("Decisão inválida.");
          await prisma.$transaction([
            prisma.memberGrant.updateMany({ where: { memberId }, data: { status: String(body.status) } }),
            prisma.memberSession.deleteMany({ where: { principal: memberId } }),
          ]);
        } else {
          if (!Array.isArray(body.apps) || body.apps.some((app) => !SISTEMAS_DE_PESSOA.includes(app as (typeof SISTEMAS_DE_PESSOA)[number]))) {
            throw new Error("Seleção de sistemas inválida.");
          }
          const escolhidos = new Set(body.apps as string[]);
          await prisma.$transaction(async (tx) => {
            /*
              Duas coisas que já deram errado aqui.

              1. O acesso ao Hub não é concedido de tabela. A linha já disse
                 "hub ou escolhido", e liberar o Vídeo para alguém criava junto
                 uma conta no Hub — que é o painel do dono. Quem pede acesso a
                 um sistema recebe aquele sistema, e mais nada.

              2. upsert, não updateMany. O update só mexia em linha que já
                 existia, então marcar um sistema que a pessoa nunca pediu não
                 fazia nada: o dono clicava, confirmava, e nada acontecia.
            */
            for (const app of SISTEMAS_DE_PESSOA) {
              const status = escolhidos.has(app) ? "approved" : "revoked";
              await tx.memberGrant.upsert({
                where: { memberId_app: { memberId, app } },
                create: { memberId, app, status },
                update: { status },
              });
            }
            await tx.memberSession.deleteMany({ where: { principal: memberId } });
          });
        }
      } else {
        const app = sistema(body.app);
        const memberId = String(body.memberId ?? "");
        if (!["approved", "rejected", "revoked"].includes(String(body.status))) throw new Error("Decisão inválida.");
        await prisma.$transaction(async (tx) => {
          await tx.memberGrant.update({ where: { memberId_app: { memberId, app } }, data: { status: String(body.status) } });
          await tx.memberSession.deleteMany({ where: { principal: memberId, app } });
        });
      }
    } else if (action === "owner") {
      await requireHubOwner(token);
      const app = sistema(body.app);
      result = { token: await issueMemberSession("owner", app), principal: "owner", owner: true };
    } else if (action === "register" || action === "login") {
      const username = String(body.username ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const app = sistema(body.app);
      if (!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username) || password.length < 10 || password.length > 128) {
        throw new Error("Use um nome de 3–32 caracteres (letras, números, ponto ou traço) e uma senha de 10–128 caracteres.");
      }
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      await throttle(`ip:${digest(ip)}`, 30);
      await throttle(`user:${username}`);
      const conta = await prisma.memberAccount.findUnique({ where: { username } });

      if (action === "register") {
        if (conta) throw new Error("Nome indisponível. Se a conta é sua, entre para pedir acesso a este sistema.");
        const pedidos = app === "hub" ? SISTEMAS : [app];
        await prisma.memberAccount.create({
          data: {
            username,
            passwordHash: await hashPassword(password),
            grants: { create: pedidos.map((pedido) => ({ app: pedido, status: "pending" })) },
          },
        });
        result = { pending: true, state: "pending", message: "Conta criada. Aguarde a aprovação do administrador no Hub." };
      } else {
        // Mesmo sem conta, gasta o tempo do hash: responder rápido quando o
        // nome não existe diria a quem está tentando quais nomes existem.
        if (!conta) {
          await hashPassword(password);
          throw new Error("Nome ou senha incorretos.");
        }
        if (!(await matchesPassword(password, conta.passwordHash))) throw new Error("Nome ou senha incorretos.");
        if (app === "hub") {
          await prisma.memberGrant.createMany({
            data: SISTEMAS.map((pedido) => ({ memberId: conta.id, app: pedido })),
            skipDuplicates: true,
          });
        }
        const grant = await prisma.memberGrant.upsert({
          where: { memberId_app: { memberId: conta.id, app } },
          create: { memberId: conta.id, app },
          update: {},
        });

        if (grant.status !== "approved") {
          /* "pending" sozinho não separa "ainda não decidiram" de "negaram", e
             a tela do outro lado precisa dizer coisas opostas nos dois casos. */
          result = {
            pending: true,
            state: grant.status === "pending" ? "pending" : "denied",
            message:
              grant.status === "pending"
                ? "Aguardando aprovação no Hub."
                : "Seu acesso a este sistema não está liberado. Fale com o administrador.",
          };
        } else {
          const sessao = await issueMemberSession(conta.id, app);
          const appTokens: Partial<Record<(typeof SISTEMAS_DE_PESSOA)[number], string>> = {};
          if (app === "hub") {
            const liberados = await prisma.memberGrant.findMany({
              where: { memberId: conta.id, app: { in: [...SISTEMAS_DE_PESSOA] }, status: "approved" },
              select: { app: true },
            });
            for (const liberado of liberados) {
              const chave = sistema(liberado.app);
              if (chave !== "hub") appTokens[chave] = await issueMemberSession(conta.id, chave);
            }
          }
          result = {
            token: sessao,
            principal: conta.id,
            username: conta.username,
            owner: false,
            ...(app === "hub" ? { appTokens } : {}),
          };
        }
      }
    } else {
      const app = sistema(body.app);
      const principal = await memberIdentity(token, app);

      if (action === "session") {
        const conta = principal === "owner" ? null : await prisma.memberAccount.findUnique({ where: { id: principal }, select: { username: true } });
        result = { principal, owner: principal === "owner", ...(conta ? { username: conta.username } : {}) };
      } else if (action === "logout") {
        await prisma.memberSession.deleteMany({ where: { digest: digest(token) } });
      } else if (action === "load") {
        result = await prisma.memberState.findUnique({ where: { principal_app: { principal, app } }, select: { payload: true, revision: true } });
      } else if (action === "save") {
        if (!body.payload || typeof body.payload !== "object" || Array.isArray(body.payload) || !Number.isSafeInteger(body.revision)) {
          throw new Error("Dados inválidos.");
        }
        const revision = Number(body.revision);
        if (revision === 0) {
          await prisma.memberState.create({ data: { principal, app, payload: body.payload as object } });
          result = { revision: 1 };
        } else {
          /* A revisão é a trava: se outra aba salvou primeiro, o update não
             acha linha e a gravação é recusada em vez de sobrescrever. */
          const atualizado = await prisma.memberState.updateMany({
            where: { principal, app, revision },
            data: { payload: body.payload as object, revision: { increment: 1 } },
          });
          if (!atualizado.count) throw new Error("Outra sessão alterou seus dados. Recarregue antes de salvar.");
          result = { revision: revision + 1 };
        }
      } else if (action === "file-put" || action === "file-list" || action === "file-get" || action === "file-delete") {
        await garantirTabelaDeArquivos().catch(() => { throw new Error(SEM_TABELA); });
        result = await arquivos(action, principal, app, body);
      } else {
        throw new Error("Ação inválida.");
      }
    }

    return NextResponse.json(result, { headers });
  } catch (error) {
    // Nunca deixar vazar consulta, conexão ou material de credencial.
    const seguro =
      error instanceof Error && !/Prisma|prisma|Unique constraint|Invalid `|\n/.test(error.message)
        ? error.message
        : "Não foi possível concluir. Seus dados foram preservados; tente novamente.";
    return NextResponse.json({ error: seguro }, { status: 400, headers });
  }
}

/**
 * Guardar, listar, buscar e apagar arquivos da pessoa — hoje, os certificados.
 *
 * Fora da função principal porque são quatro ações que só falam entre si, e
 * deixá-las lá dentro fazia o bloco crescer sem que nenhuma delas tivesse a
 * ver com conta, sessão ou aprovação.
 */
async function arquivos(action: string, principal: string, app: string, body: Record<string, unknown>) {
  const chave = String(body.chave ?? "").trim();

  if (action === "file-list") {
    // Sem o conteúdo: a lista é só para a tela saber o que existe.
    return prisma.memberFile.findMany({
      where: { principal, app },
      select: { chave: true, nome: true, tipo: true, tamanho: true, criadoEm: true },
      orderBy: { criadoEm: "desc" },
      take: 200,
    });
  }

  if (!chave || chave.length > 120) throw new Error("Chave de arquivo inválida.");

  if (action === "file-put") {
    /*
      O formato é conferido pelos primeiros bytes, não pela extensão nem pelo
      tipo que o navegador declara: os dois são texto que quem envia escolhe.
      O nome também é refeito aqui, porque nome de arquivo vindo de fora é
      onde se esconde caminho e caractere de controle.
    */
    if (typeof body.conteudo !== "string") throw new Error("Arquivo ausente.");

    const bytes = Buffer.from(body.conteudo, "base64");
    if (!bytes.length) throw new Error("Arquivo vazio.");
    if (bytes.length > LIMITE_BYTES) {
      throw new Error(`O arquivo passa de ${Math.round(LIMITE_BYTES / 100000) / 10} MB. Envie um menor.`);
    }

    const formato = formatoDe(bytes);
    if (!formato) throw new Error("Só PDF, PNG, JPG ou WEBP. O arquivo enviado não é nenhum dos quatro.");

    const nome = nomeSeguro(String(body.nome ?? ""), formato.extensao);
    const dados = { nome, tipo: formato.tipo, tamanho: bytes.length, conteudo: bytes };
    await prisma.memberFile.upsert({
      where: { principal_app_chave: { principal, app, chave } },
      create: { principal, app, chave, ...dados },
      update: dados,
    });
    return { chave, nome, tipo: formato.tipo, tamanho: bytes.length };
  }

  if (action === "file-get") {
    const arquivo = await prisma.memberFile.findUnique({
      where: { principal_app_chave: { principal, app, chave } },
    });
    if (!arquivo) throw new Error("Arquivo não encontrado.");
    return {
      chave: arquivo.chave,
      nome: arquivo.nome,
      tipo: arquivo.tipo,
      conteudo: Buffer.from(arquivo.conteudo).toString("base64"),
    };
  }

  await prisma.memberFile.deleteMany({ where: { principal, app, chave } });
  return { ok: true };
}
