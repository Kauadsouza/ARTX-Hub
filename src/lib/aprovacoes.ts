/**
 * Aprovação de contas: o estado que a tela mostra.
 *
 * Isto morava dentro do componente e tinha um defeito que fazia a tela mentir.
 * A linha era:
 *
 *   next[key] = { ...next[key], [app]: current[key]?.[app] ?? row.status === 'approved' }
 *
 * O `??` só aceita o valor do servidor quando o local é `undefined`. Depois da
 * primeira carga o local nunca é — é `true` ou `false` — então o servidor
 * deixava de ser ouvido para sempre. Bloquear uma conta revogava tudo no banco
 * e a tela continuava mostrando os sistemas marcados.
 *
 * Aqui a regra é explícita: recarregar traz a verdade do servidor. O que a
 * pessoa marcou fica valendo enquanto ela edita, e é substituído na próxima
 * leitura — que só acontece ao abrir a tela ou depois de uma ação dela.
 */

export type AppKey = "videos" | "study" | "university";

export type Concessao = {
  memberId: string;
  app: "hub" | AppKey;
  status: string;
  member: { username: string; createdAt: string };
};

export type Conta = {
  key: string;
  username: string;
  createdAt: string;
  grants: Concessao[];
};

export type Selecoes = Record<string, Partial<Record<AppKey, boolean>>>;

/** Uma linha por pessoa, com todas as concessões dela juntas. */
export function agrupar(linhas: Concessao[]): Conta[] {
  const mapa: Record<string, Conta> = {};
  for (const linha of linhas) {
    const key = linha.member.username.trim().toLowerCase();
    mapa[key] ??= { key, username: linha.member.username, createdAt: linha.member.createdAt, grants: [] };
    mapa[key].grants.push(linha);
  }
  return Object.values(mapa).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * As caixas marcadas, a partir do que o servidor respondeu.
 *
 * Sempre do servidor. O estado local anterior não entra: se entrasse, uma conta
 * recém-bloqueada continuaria aparecendo com sistemas liberados, e o próximo
 * clique mandaria de volta uma seleção que já não existia.
 */
export function selecoesDoServidor(linhas: Concessao[]): Selecoes {
  const selecoes: Selecoes = {};
  for (const linha of linhas) {
    if (linha.app === "hub") continue;
    const key = linha.member.username.trim().toLowerCase();
    selecoes[key] = { ...selecoes[key], [linha.app]: linha.status === "approved" };
  }
  return selecoes;
}

export type EstadoConta = "ativa" | "aguardando" | "bloqueada";

/**
 * Em que pé a conta está.
 *
 * O acesso ao Hub é o que decide: sem ele a pessoa não entra em lugar nenhum,
 * por mais sistemas que estejam marcados.
 */
export function estadoDaConta(conta: Conta): EstadoConta {
  const hub = conta.grants.find((grant) => grant.app === "hub")?.status;
  if (hub === "approved") return "ativa";
  if (hub === "pending") return "aguardando";
  return "bloqueada";
}

export const rotuloDoEstado: Record<EstadoConta, string> = {
  ativa: "Conta ativa",
  aguardando: "Aguardando você",
  bloqueada: "Conta bloqueada",
};

/**
 * Quais botões cada estado merece.
 *
 * A tela oferecia "Bloquear conta" numa conta já bloqueada — um botão que pede
 * confirmação para não fazer nada — e chamava de "Aprovar conta" a ação que
 * desbloqueia, o que ninguém liga uma coisa à outra. Cada estado agora oferece
 * só o que faz sentido nele, com o nome do que vai acontecer.
 */
export function acoesDoEstado(estado: EstadoConta): { principal: string; podeBloquear: boolean } {
  if (estado === "ativa") return { principal: "Salvar acessos", podeBloquear: true };
  if (estado === "aguardando") return { principal: "Aprovar conta", podeBloquear: true };
  return { principal: "Desbloquear conta", podeBloquear: false };
}

/** Quantos sistemas estão marcados para esta conta. */
export function contarSelecionados(selecoes: Selecoes, key: string): number {
  return Object.values(selecoes[key] ?? {}).filter(Boolean).length;
}

/** Os ids de membro da conta, sem repetir. */
export function idsDaConta(conta: Conta): string[] {
  return [...new Set(conta.grants.map((grant) => grant.memberId))];
}
