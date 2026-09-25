import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHubOwner } from "@/lib/contas-auth";
import {
  ROTULO_ETAPA,
  lerResumoDeCursos,
  progressoDoVideo,
  type Bloco,
  type CursoNoPainel,
  type Etapa,
  type EstadoBloco,
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

async function cursosDoDono(): Promise<CursoNoPainel[] | null> {
  try {
    const estado = await prisma.memberState.findUnique({
      where: { principal_app: { principal: "owner", app: "cursos" } },
      select: { payload: true },
    });
    return lerResumoDeCursos(estado?.payload ?? null);
  } catch {
    return null;
  }
}

async function videosDoDono(): Promise<VideoNoPainel[] | null> {
  try {
    const videos = await prisma.$queryRaw<{ id: string; title: string; stage: string }[]>`
      SELECT id, title, stage::text AS stage
      FROM "Video"
      WHERE "ownerId" = 'owner'
      ORDER BY "updatedAt" DESC
      LIMIT 40
    `;
    if (!videos.length) return [];

    const ids = videos.map((video) => video.id);
    const blocos = await prisma.$queryRaw<{ videoId: string; gravacao: EstadoBloco; edicao: EstadoBloco }[]>`
      SELECT "videoId", "recordingStatus"::text AS gravacao, "editingStatus"::text AS edicao
      FROM "ScriptBlock"
      WHERE "videoId" = ANY(${ids})
    `;

    const porVideo = new Map<string, Bloco[]>();
    for (const b of blocos) {
      const lista = porVideo.get(b.videoId) ?? [];
      lista.push({ gravacao: b.gravacao, edicao: b.edicao });
      porVideo.set(b.videoId, lista);
    }

    return videos.map((video) => {
      const etapa = video.stage as Etapa;
      return {
        id: video.id,
        titulo: video.title || "Sem título",
        etapa,
        rotulo: ROTULO_ETAPA[etapa] ?? video.stage,
        progresso: progressoDoVideo(video.stage, porVideo.get(video.id) ?? []),
      };
    });
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

  const [cursos, videos] = await Promise.all([cursosDoDono(), videosDoDono()]);

  // `null` é "não deu para ler"; `[]` é "não há nada". A tela mostra coisas
  // diferentes para cada um, então a diferença precisa chegar até ela.
  return NextResponse.json(
    { cursos, videos, lidoEm: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
