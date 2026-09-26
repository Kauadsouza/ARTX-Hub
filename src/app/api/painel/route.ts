import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHubOwner } from "@/lib/contas-auth";
import {
  ROTULO_ETAPA,
  lerEstudo,
  lerResumoDeCursos,
  progressoDoVideo,
  type Bloco,
  type CursoNoPainel,
  type Estudo,
  type Etapa,
  type EstadoBloco,
  type Pedido,
  type VideoNoPainel,
} from "@/lib/painel";

/**
 * Os números da visão geral.
 *
 * O Hub é o único ponto que centraliza, então é daqui que se enxerga o
 * andamento de todos os sistemas de uma vez. Nenhum sistema fala com outro
 * para isso: cada um guarda o seu, e o Hub lê.
 *
 * Só leitura, e só do dono. Os números de cada sistema falham sozinhos — se
 * a parte dos vídeos não responder, os cursos continuam aparecendo, e a tela
 * diz qual parte faltou em vez de ficar em branco.
 *
 * A consulta aos vídeos olha direto a tabela do sistema de vídeos, porque os
 * dois ainda dividem o banco. É uma leitura estreita — título, etapa e o
 * estado dos blocos —, isolada nesta função, para que o dia em que o banco
 * se separar troque só ela por uma pergunta ao sistema de vídeos.
 */

export const runtime = "nodejs";

async function cursosDoDono(): Promise<{ cursos: CursoNoPainel[]; estudo: Estudo | null } | null> {
  try {
    const estado = await prisma.memberState.findUnique({
      where: { principal_app: { principal: "owner", app: "cursos" } },
      select: { payload: true },
    });
    const payload = estado?.payload ?? null;
    return { cursos: lerResumoDeCursos(payload), estudo: lerEstudo(payload) };
  } catch {
    return null;
  }
}

/*
  Uma consulta só para os vídeos, e não duas em sequência.

  Antes eram duas idas ao banco — os vídeos, depois os blocos de cada um — e
  a segunda só saía quando a primeira voltava. Aqui o banco já devolve cada
  vídeo com a contagem dos blocos por estado, e a conta do avanço é feita a
  partir dessas contagens.
*/
type LinhaVideo = {
  id: string;
  title: string;
  stage: string;
  atualizado: Date;
  blocos: number;
  grav_pronto: number;
  grav_andando: number;
  edit_pronto: number;
  edit_andando: number;
};

function blocosDaContagem(l: LinhaVideo): Bloco[] {
  // O avanço de uma etapa só olha o estado daquela etapa, então dá para
  // remontar os blocos a partir das contagens sem perder nada.
  const lista: Bloco[] = [];
  for (let i = 0; i < l.blocos; i++) {
    const gravacao: EstadoBloco = i < l.grav_pronto ? "PRONTO" : i < l.grav_pronto + l.grav_andando ? "EM_PROGRESSO" : "PENDENTE";
    const edicao: EstadoBloco = i < l.edit_pronto ? "PRONTO" : i < l.edit_pronto + l.edit_andando ? "EM_PROGRESSO" : "PENDENTE";
    lista.push({ gravacao, edicao });
  }
  return lista;
}

async function videosDoDono(): Promise<(VideoNoPainel & { atualizadoEm: string })[] | null> {
  try {
    const linhas = await prisma.$queryRaw<LinhaVideo[]>`
      SELECT v.id, v.title, v.stage::text AS stage, v."updatedAt" AS atualizado,
        count(b.id)::int AS blocos,
        count(b.id) FILTER (WHERE b."recordingStatus" = 'PRONTO')::int AS grav_pronto,
        count(b.id) FILTER (WHERE b."recordingStatus" = 'EM_PROGRESSO')::int AS grav_andando,
        count(b.id) FILTER (WHERE b."editingStatus" = 'PRONTO')::int AS edit_pronto,
        count(b.id) FILTER (WHERE b."editingStatus" = 'EM_PROGRESSO')::int AS edit_andando
      FROM "Video" v
      LEFT JOIN "ScriptBlock" b ON b."videoId" = v.id
      WHERE v."ownerId" = 'owner'
      GROUP BY v.id
      ORDER BY v."updatedAt" DESC
      LIMIT 40
    `;
    return linhas.map((l) => {
      const etapa = l.stage as Etapa;
      return {
        id: l.id,
        titulo: l.title || "Sem título",
        etapa,
        rotulo: ROTULO_ETAPA[etapa] ?? l.stage,
        progresso: progressoDoVideo(l.stage, blocosDaContagem(l)),
        atualizadoEm: new Date(l.atualizado).toISOString(),
      };
    });
  } catch {
    return null;
  }
}

const NOME_DO_SISTEMA: Record<string, string> = { videos: "Vídeos", study: "Inglês", university: "Universidades", cursos: "Cursos" };

/** Quem está esperando uma decisão sua — o número que mais pede ação. */
async function pedidosPendentes(): Promise<Pedido[] | null> {
  try {
    const linhas = await prisma.memberGrant.findMany({
      where: { status: "pending", app: { not: "hub" } },
      select: { app: true, updatedAt: true, member: { select: { username: true } } },
      orderBy: { updatedAt: "desc" },
      take: 60,
    });
    // Uma entrada por pessoa, com todos os sistemas que ela pediu.
    const porPessoa = new Map<string, Pedido>();
    for (const l of linhas) {
      const atual = porPessoa.get(l.member.username);
      const sistema = NOME_DO_SISTEMA[l.app] ?? l.app;
      if (atual) atual.sistemas.push(sistema);
      else porPessoa.set(l.member.username, { usuario: l.member.username, sistemas: [sistema], quando: l.updatedAt.toISOString() });
    }
    return [...porPessoa.values()];
  } catch {
    return null;
  }
}

/*
  POST, e não GET, embora só leia.

  O Hub também é montado como site estático para o aplicativo do Windows, e
  nesse modo uma rota GET precisa ser pré-gerada no build — o que não faz
  sentido para números que mudam a cada minuto. Rotas POST passam pela
  exportação sem exigir isso, como as de contas e da Jade. Na versão estática
  a rota simplesmente não responde, e a visão geral diz que não conseguiu
  buscar os números em vez de quebrar.
*/
export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  try {
    await requireHubOwner(token);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Acesso negado." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  // As três leituras saem juntas: nenhuma depende da outra.
  const [daConta, videos, pedidos] = await Promise.all([cursosDoDono(), videosDoDono(), pedidosPendentes()]);

  // `null` é "não deu para ler"; `[]` é "não há nada". A tela mostra coisas
  // diferentes para cada um, então a diferença precisa chegar até ela.
  return NextResponse.json(
    {
      cursos: daConta?.cursos ?? null,
      estudo: daConta ? daConta.estudo : null,
      videos,
      pedidos,
      lidoEm: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
