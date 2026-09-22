/**
 * O que fazer agora, somando os sistemas.
 *
 * Seis sistemas, seis conjuntos de datas, nenhum lugar que responda "o que eu
 * faço esta semana". O Hub era um lançador de atalhos: cada cartão dizia o que
 * o sistema É, nunca o que está pendente nele.
 *
 * Aqui não há texto fixo. Cada linha existe porque algum dado a produziu, e
 * some quando o dado some. Sem rota criada não há linha de prazo; sem tarefa
 * atrasada não há linha de tarefa.
 *
 * O University Path publica seu próprio resumo de prazos, porque ele é o dono
 * do calendário de cada país. O Hub só consome — duplicar esse catálogo aqui
 * significaria manter dois calendários que divergem em silêncio.
 */

export type Urgency = "agora" | "semana" | "mes" | "adiante";

export type Signal = {
  id: string;
  /** Para onde o clique leva. */
  target: "site" | "videos" | "sat" | "university" | "jade" | "overview";
  urgency: Urgency;
  title: string;
  /** O número que importa, já pronto para a tela. */
  value: string;
  detail: string;
};

export type RouteSignals = {
  routeCount: number;
  nextDeadline: { routeName: string; country: string; label: string; date: string } | null;
  chosenUniversities: number;
};

export type Task = { id: string; title: string; project_slug: string | null; completed: boolean };

/**
 * Dias de calendário que faltam, não horas decorridas.
 *
 * Arredondar horas dizia "1 dia" para um prazo que vence hoje às 23h, porque
 * faltavam 0,46 dia e o teto sobe para 1. Num prazo de candidatura isso faz a
 * pessoa achar que tem mais um dia inteiro. Aqui a comparação é entre datas:
 * vence hoje é 0, vence amanhã é 1, a qualquer hora.
 */
export function daysUntil(date: string, now = new Date()): number {
  const target = new Date(date);
  const alvo = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  const hoje = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((alvo - hoje) / 86_400_000);
}

function urgencyFor(days: number): Urgency {
  if (days <= 7) return "agora";
  if (days <= 30) return "semana";
  if (days <= 90) return "mes";
  return "adiante";
}

const order: Record<Urgency, number> = { agora: 0, semana: 1, mes: 2, adiante: 3 };

const targetFor: Record<string, Signal["target"]> = {
  university: "university",
  sat: "sat",
  videos: "videos",
  site: "site",
  geral: "overview",
};

/**
 * Monta a lista a partir do que existe. Uma entrada ausente não vira aviso de
 * erro nem espaço vazio: simplesmente não produz linha.
 */
export function buildWeek({
  routes,
  tasks,
  now = new Date(),
}: {
  routes?: RouteSignals | null;
  tasks?: Task[];
  now?: Date;
}): Signal[] {
  const signals: Signal[] = [];

  if (routes?.nextDeadline) {
    const days = daysUntil(routes.nextDeadline.date, now);
    if (days >= 0) {
      signals.push({
        id: "deadline",
        target: "university",
        urgency: urgencyFor(days),
        title: routes.nextDeadline.label,
        value: days === 0 ? "hoje" : days === 1 ? "1 dia" : `${days} dias`,
        detail: `Rota ${routes.nextDeadline.routeName}`,
      });
    }
  }

  if (routes && routes.routeCount > 0 && routes.chosenUniversities === 0) {
    signals.push({
      id: "no-universities",
      target: "university",
      urgency: "semana",
      title: "Nenhuma universidade escolhida ainda",
      value: `${routes.routeCount}`,
      detail: routes.routeCount === 1 ? "rota sem destino definido" : "rotas sem destino definido",
    });
  }

  const open = (tasks ?? []).filter((task) => !task.completed);
  if (open.length > 0) {
    const byProject = new Map<string, number>();
    for (const task of open) {
      const key = task.project_slug ?? "geral";
      byProject.set(key, (byProject.get(key) ?? 0) + 1);
    }
    const [topKey, topCount] = [...byProject.entries()].sort((a, b) => b[1] - a[1])[0];
    signals.push({
      id: "tasks",
      target: targetFor[topKey] ?? "overview",
      urgency: open.length > 8 ? "semana" : "mes",
      title: open.length === 1 ? "1 passo em aberto" : `${open.length} passos em aberto`,
      value: String(topCount),
      detail: `concentrados em ${projectLabel(topKey)}`,
    });
  }

  return signals.sort((a, b) => order[a.urgency] - order[b.urgency]);
}

export function projectLabel(slug: string): string {
  const labels: Record<string, string> = {
    geral: "Pessoal",
    sat: "Idiomas",
    videos: "Video Studio",
    site: "Site KauaArtx",
    university: "University Path",
    jade: "Jade",
  };
  return labels[slug] ?? slug;
}

/** Lê o resumo que o University Path publica, tolerando qualquer formato. */
export function parseRouteSignals(payload: unknown): RouteSignals | null {
  if (!payload || typeof payload !== "object") return null;
  const signals = (payload as Record<string, unknown>).signals;
  if (!signals || typeof signals !== "object") return null;

  const value = signals as Record<string, unknown>;
  const routeCount = typeof value.routeCount === "number" ? value.routeCount : 0;
  const chosenUniversities = typeof value.chosenUniversities === "number" ? value.chosenUniversities : 0;

  let nextDeadline: RouteSignals["nextDeadline"] = null;
  const deadline = value.nextDeadline;
  if (deadline && typeof deadline === "object") {
    const entry = deadline as Record<string, unknown>;
    if (typeof entry.date === "string" && !Number.isNaN(new Date(entry.date).getTime())) {
      nextDeadline = {
        routeName: typeof entry.routeName === "string" ? entry.routeName : "",
        country: typeof entry.country === "string" ? entry.country : "",
        label: typeof entry.label === "string" ? entry.label : "Prazo",
        date: entry.date,
      };
    }
  }

  return { routeCount, nextDeadline, chosenUniversities };
}
