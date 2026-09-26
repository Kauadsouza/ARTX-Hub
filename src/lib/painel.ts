/**
 * As contas por trás dos gráficos da visão geral.
 *
 * Tudo aqui é puro: recebe dados, devolve números. A leitura do banco fica na
 * rota, e a tela só desenha. Separar assim é o que permite testar a parte que
 * pode mentir — a porcentagem — sem banco e sem navegador.
 */

import { semTraducao, type Traduzir } from "./traducao.ts";

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

// ── Ritmo de estudo ────────────────────────────────────────────────────

export type AulaRecente = { curso: string; aula: string; numero: number; quando: string };
export type Estudo = { sequencia: number; porDia: Record<string, number>; recentes: AulaRecente[] };

/** O ritmo que o sistema de cursos grava, lido sem confiar nele. */
export function lerEstudo(payload: unknown): Estudo | null {
  const bruto = (payload as { estudo?: unknown } | null)?.estudo as Partial<Estudo> | undefined;
  if (!bruto || typeof bruto !== "object") return null;
  const porDia: Record<string, number> = {};
  if (bruto.porDia && typeof bruto.porDia === "object") {
    for (const [dia, n] of Object.entries(bruto.porDia)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dia) && Number.isFinite(Number(n)) && Number(n) > 0) porDia[dia] = Math.round(Number(n));
    }
  }
  const recentes = Array.isArray(bruto.recentes)
    ? bruto.recentes.flatMap((r) => {
        const a = r as Partial<AulaRecente>;
        return typeof a.curso === "string" && typeof a.aula === "string" && typeof a.quando === "string" && !Number.isNaN(Date.parse(a.quando))
          ? [{ curso: a.curso, aula: a.aula, numero: Number(a.numero) || 0, quando: a.quando }]
          : [];
      }).slice(0, 8)
    : [];
  const sequencia = Number.isFinite(Number(bruto.sequencia)) ? Math.max(0, Math.round(Number(bruto.sequencia))) : 0;
  return { sequencia, porDia, recentes };
}

/**
 * Os últimos `n` dias, do mais antigo para hoje, com as aulas de cada um.
 *
 * Dia sem aula entra com zero: um gráfico que pula os dias vazios esconde
 * justamente as pausas, que é o que ele existe para mostrar.
 */
/**
 * O dia do calendário local. O sistema de cursos grava os dias assim — no
 * navegador de quem estuda —, e o Hub precisa contar do mesmo jeito: em UTC,
 * a coluna de hoje virava amanhã depois das nove da noite no Brasil.
 */
export function diaLocal(data: Date): string {
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}`;
}

export function ultimosDias(porDia: Record<string, number>, n = 14, agora = new Date()): { dia: string; aulas: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const data = new Date(agora);
    data.setDate(data.getDate() - (n - 1 - i));
    const dia = diaLocal(data);
    return { dia, aulas: porDia[dia] ?? 0 };
  });
}

export function aulasNosUltimos(porDia: Record<string, number>, n: number, agora = new Date()): number {
  return ultimosDias(porDia, n, agora).reduce((soma, d) => soma + d.aulas, 0);
}

// ── O que está acontecendo ─────────────────────────────────────────────

export type Pedido = { usuario: string; sistemas: string[]; quando: string };

export type Acontecimento = {
  tipo: "aula" | "video" | "pedido";
  titulo: string;
  /** O curso da aula. Nome próprio: não se traduz. */
  detalhe: string;
  quando: string;
  /* Os pedaços que viram frase na tela, e não aqui: montar "pediu Cursos"
     ou "Gravação · 29%" nesta função prenderia a frase ao português. */
  etapa?: string;
  progresso?: number;
  sistemas?: string[];
  /** A aula pelo número e pelo nome, para a tela escrever "Aula 3" ou "Lesson 3". */
  numero?: number;
  aula?: string;
};

/**
 * A linha do tempo: o que mudou por último, de onde quer que tenha vindo.
 *
 * É isto que faz a página parecer viva — em vez de só o estado das coisas,
 * o movimento delas. Aula concluída, vídeo que andou de etapa, alguém pedindo
 * acesso. Mais recente primeiro, e com data inválida fora.
 */
export function acontecimentos(
  { estudo, videos, pedidos }: { estudo: Estudo | null; videos: (VideoNoPainel & { atualizadoEm?: string })[] | null; pedidos: Pedido[] | null },
  limite = 8,
): Acontecimento[] {
  const lista: Acontecimento[] = [];
  for (const a of estudo?.recentes ?? []) {
    lista.push({ tipo: "aula", titulo: a.numero ? `Aula ${a.numero} — ${a.aula}` : a.aula, detalhe: a.curso, quando: a.quando, numero: a.numero, aula: a.aula });
  }
  for (const v of videos ?? []) {
    if (!v.atualizadoEm) continue;
    lista.push({ tipo: "video", titulo: v.titulo, detalhe: "", etapa: v.rotulo, progresso: v.progresso, quando: v.atualizadoEm });
  }
  for (const p of pedidos ?? []) {
    lista.push({ tipo: "pedido", titulo: p.usuario, detalhe: "", sistemas: p.sistemas, quando: p.quando });
  }
  return lista
    .filter((a) => !Number.isNaN(Date.parse(a.quando)))
    .sort((a, b) => Date.parse(b.quando) - Date.parse(a.quando))
    .slice(0, limite);
}

/**
 * "agora", "há 5 min", "há 3 h", "ontem", "há 4 dias", ou a data.
 *
 * O número entra por `{0}`: "há {0} min" é uma chave só no catálogo de
 * tradução, qualquer que seja o número.
 */
export function haQuanto(iso: string, agora = new Date(), traduzir: Traduzir = semTraducao, locale = "pt-BR"): string {
  const segundos = Math.max(0, (agora.getTime() - Date.parse(iso)) / 1000);
  if (segundos < 60) return traduzir("agora");
  if (segundos < 3600) return traduzir("há {0} min", [Math.floor(segundos / 60)]);
  if (segundos < 86400) return traduzir("há {0} h", [Math.floor(segundos / 3600)]);
  const dias = Math.floor(segundos / 86400);
  if (dias === 1) return traduzir("ontem");
  if (dias < 7) return traduzir("há {0} dias", [dias]);
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });
}
