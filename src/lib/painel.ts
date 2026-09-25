/**
 * As contas por trás dos gráficos da visão geral.
 *
 * Tudo aqui é puro: recebe dados, devolve números. A leitura do banco fica na
 * rota, e a tela só desenha. Separar assim é o que permite testar a parte que
 * pode mentir — a porcentagem — sem banco e sem navegador.
 */

// ── Vídeos ─────────────────────────────────────────────────────────────

/** As oito etapas da produção, na ordem do sistema de vídeos. */
export const ETAPAS = [
  "IDEIA",
  "ROTEIRO",
  "GRAVACAO",
  "EDICAO",
  "THUMBNAIL_TITULO",
  "REVISAO",
  "AGENDADO",
  "POSTADO",
] as const;

export type Etapa = (typeof ETAPAS)[number];

export const ROTULO_ETAPA: Record<Etapa, string> = {
  IDEIA: "Ideia",
  ROTEIRO: "Roteiro",
  GRAVACAO: "Gravação",
  EDICAO: "Edição",
  THUMBNAIL_TITULO: "Capa e título",
  REVISAO: "Revisão",
  AGENDADO: "Agendado",
  POSTADO: "Publicado",
};

export type EstadoBloco = "PENDENTE" | "EM_PROGRESSO" | "PRONTO";
export type Bloco = { gravacao: EstadoBloco; edicao: EstadoBloco };

function etapaValida(valor: string): valor is Etapa {
  return (ETAPAS as readonly string[]).includes(valor);
}

/** Pronto vale inteiro, em andamento vale meio. Pendente não vale nada. */
function peso(estado: EstadoBloco): number {
  return estado === "PRONTO" ? 1 : estado === "EM_PROGRESSO" ? 0.5 : 0;
}

/**
 * Quanto do vídeo já foi feito, de 0 a 1.
 *
 * Cada etapa concluída vale uma fatia igual; a etapa atual vale uma fração da
 * sua fatia, quando dá para medir. Gravação e edição dá: o roteiro vem em
 * blocos, e cada bloco tem o seu estado. As outras etapas são de uma vez só
 * — ou a capa está feita ou não está —, então valem zero até a próxima.
 *
 * Ideia é 0% e Publicado é 100%. Por isso são sete intervalos entre oito
 * etapas, e não oito: sem isso, um vídeo publicado apareceria com 87%.
 */
export function progressoDoVideo(etapa: string, blocos: Bloco[]): number {
  if (!etapaValida(etapa)) return 0;
  const indice = ETAPAS.indexOf(etapa);
  if (etapa === "POSTADO") return 1;

  let parcial = 0;
  if (blocos.length) {
    if (etapa === "GRAVACAO") parcial = blocos.reduce((soma, b) => soma + peso(b.gravacao), 0) / blocos.length;
    else if (etapa === "EDICAO") parcial = blocos.reduce((soma, b) => soma + peso(b.edicao), 0) / blocos.length;
    // Roteiro com blocos já começou a ser escrito, mas escrever não tem
    // estado próprio — metade da fatia é o que se pode afirmar sem inventar.
    else if (etapa === "ROTEIRO") parcial = 0.5;
  }

  return Math.min(1, (indice + parcial) / (ETAPAS.length - 1));
}

export type VideoNoPainel = {
  id: string;
  titulo: string;
  etapa: Etapa;
  rotulo: string;
  progresso: number;
};

/** Quantos vídeos estão em cada etapa, na ordem da produção — inclusive as vazias. */
export function porEtapa(videos: Pick<VideoNoPainel, "etapa">[]): { etapa: Etapa; rotulo: string; total: number }[] {
  return ETAPAS.map((etapa) => ({
    etapa,
    rotulo: ROTULO_ETAPA[etapa],
    total: videos.filter((video) => video.etapa === etapa).length,
  }));
}

// ── Cursos ─────────────────────────────────────────────────────────────

export type CursoNoPainel = { id: string; titulo: string; categoria: string; feitas: number; total: number };

/**
 * O resumo que o sistema de cursos grava, lido sem confiar nele.
 *
 * Vem do banco, mas foi escrito pelo navegador de alguém. Qualquer linha
 * torta — total zero, feitas maior que total, campo faltando — sai, em vez
 * de virar uma barra com 140% na tela.
 */
export function lerResumoDeCursos(payload: unknown): CursoNoPainel[] {
  const resumo = (payload as { resumo?: unknown } | null)?.resumo;
  if (!Array.isArray(resumo)) return [];
  return resumo.flatMap((item) => {
    const c = item as Partial<CursoNoPainel>;
    if (typeof c.id !== "string" || typeof c.titulo !== "string") return [];
    const total = Number(c.total);
    const feitas = Number(c.feitas);
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(feitas) || feitas < 0) return [];
    return [{ id: c.id, titulo: c.titulo, categoria: String(c.categoria ?? ""), feitas: Math.min(feitas, total), total }];
  });
}

export type NumerosDeCursos = { emAndamento: number; concluidos: number; naoIniciados: number; aulasFeitas: number };

export function numerosDeCursos(cursos: CursoNoPainel[]): NumerosDeCursos {
  return {
    emAndamento: cursos.filter((c) => c.feitas > 0 && c.feitas < c.total).length,
    concluidos: cursos.filter((c) => c.feitas >= c.total).length,
    naoIniciados: cursos.filter((c) => c.feitas === 0).length,
    aulasFeitas: cursos.reduce((soma, c) => soma + c.feitas, 0),
  };
}

/**
 * A ordem das barras: o que está em andamento primeiro, do mais perto de
 * acabar para o mais longe; depois os concluídos; por fim os não começados.
 * É a ordem de "o que eu faço agora".
 */
export function ordenarCursos(cursos: CursoNoPainel[]): CursoNoPainel[] {
  const grupo = (c: CursoNoPainel) => (c.feitas > 0 && c.feitas < c.total ? 0 : c.feitas >= c.total ? 1 : 2);
  return [...cursos].sort((a, b) => grupo(a) - grupo(b) || b.feitas / b.total - a.feitas / a.total || a.titulo.localeCompare(b.titulo));
}
