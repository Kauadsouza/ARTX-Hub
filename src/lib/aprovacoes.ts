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

import { semTraducao, type Traduzir } from "./traducao.ts";

export type AppKey = "videos" | "study" | "university" | "cursos";

export type Concessao = {
  memberId: string;
  app: "hub" | AppKey;
  status: string;
  /** Quando esta concessão mudou pela última vez. */
  updatedAt?: string;
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
 *
 * O sistema PEDIDO vem marcado, e isso conserta um estrago.
 *
 * Antes só `approved` vinha marcado. Uma conta nova, portanto, abria com todas
 * as caixas vazias — e o botão dela dizia "Aprovar conta". Clicar mandava uma
 * seleção vazia, e seleção vazia significa "retire tudo". O dono clicava em
 * aprovar e revogava justamente o acesso que a pessoa tinha pedido; ela voltava
 * ao sistema e continuava barrada. Foi o que aconteceu.
 *
 * Marcar o pendente faz o botão cumprir o que o nome promete: aprovar o que foi
 * pedido. A caixa continua visível e desmarcável, com o rótulo dizendo que
 * aquele sistema está aguardando, então negar segue sendo um clique.
 */
export function selecoesDoServidor(linhas: Concessao[]): Selecoes {
  const selecoes: Selecoes = {};
  for (const linha of linhas) {
    if (linha.app === "hub") continue;
    const key = linha.member.username.trim().toLowerCase();
    const marcada = linha.status === "approved" || linha.status === "pending";
    selecoes[key] = { ...selecoes[key], [linha.app]: marcada };
  }
  return selecoes;
}

/**
 * Se a ação principal pode ser aplicada do jeito que está.
 *
 * Seleção vazia quer dizer "retire todos os acessos". Numa conta ativa isso é
 * uma ação legítima, e a confirmação avisa. Numa conta aguardando ou bloqueada
 * o botão se chama "Aprovar conta" ou "Desbloquear conta" — mandar uma seleção
 * vazia ali faria o contrário exato do que está escrito nele, e nenhuma
 * confirmação conserta um botão que mente.
 */
export function podeAplicar(
  estado: EstadoConta,
  escolhidos: number,
  traduzir: Traduzir = semTraducao,
): { ok: true } | { ok: false; motivo: string } {
  if (escolhidos > 0 || estado === "ativa") return { ok: true };
  return {
    ok: false,
    motivo: estado === "aguardando"
      ? traduzir("Marque ao menos um sistema para aprovar. Para negar o pedido, use Bloquear conta.")
      : traduzir("Marque ao menos um sistema para desbloquear."),
  };
}

export type EstadoConta = "ativa" | "aguardando" | "bloqueada";

/**
 * Apagar uma conta: o que vai junto, e quanto cuidado a confirmação precisa.
 *
 * Bloquear é reversível — a conta continua lá, sem acesso. Apagar não é: leva
 * a conta, os acessos e tudo o que a pessoa guardou nos sistemas liberados.
 *
 * Por isso o cuidado é proporcional ao que se perde. Uma conta que nunca foi
 * aprovada não guardou nada em lugar nenhum, e exigir cerimônia para remover
 * um pedido de teste só faz o dono parar de limpar. Uma conta em uso tem
 * progresso de curso, planejamento, anotações — essa pede o nome digitado,
 * porque um clique errado ali não tem volta.
 */
export type Exclusao = {
  confirmacao: "simples" | "digitar-nome";
  aviso: string;
};

export function exclusaoDaConta(conta: Conta, traduzir: Traduzir = semTraducao): Exclusao {
  const nome = conta.username;

  if (estadoDaConta(conta) === "ativa") {
    return {
      confirmacao: "digitar-nome",
      aviso: [
        traduzir("A conta de {0} está em uso.", [nome]),
        "",
        traduzir("Apagar remove a conta, os acessos e tudo o que ela guardou nos sistemas — progresso, planejamento, anotações. Não dá para desfazer."),
        "",
        traduzir("Se é isso mesmo, digite o nome de usuário: {0}", [nome]),
      ].join("\n"),
    };
  }

  return {
    confirmacao: "simples",
    aviso: [
      traduzir("Apagar a conta de {0}?", [nome]),
      "",
      traduzir("Ela nunca teve acesso liberado, então não há nada guardado para perder. Ainda assim, não dá para desfazer."),
    ].join("\n"),
  };
}

/**
 * Em que pé a conta está.
 *
 * O estado vem dos SISTEMAS, não do Hub.
 *
 * Antes o acesso ao Hub era o interruptor geral, o que fazia sentido quando
 * todo mundo entrava por ele. Hoje ninguém entra: a pessoa cria conta dentro do
 * sistema que quer usar, e o Hub é só o painel onde o dono decide. Quem pediu
 * Vídeos e foi liberado não tem linha de Hub nenhuma — e pela regra antiga
 * aparecia como bloqueado, com o acesso funcionando.
 *
 *   ativa       ao menos um sistema liberado
 *   aguardando  nenhum liberado, mas algum esperando decisão
 *   bloqueada   nada liberado e nada esperando
 */
export function estadoDaConta(conta: Conta): EstadoConta {
  const sistemas = conta.grants.filter((grant) => grant.app !== "hub");
  if (sistemas.some((grant) => grant.status === "approved")) return "ativa";
  if (sistemas.some((grant) => grant.status === "pending")) return "aguardando";
  return "bloqueada";
}

export type EstadoSistema = "liberado" | "esperando" | "negado" | "nao-pediu";

/**
 * O que cada sistema está para esta pessoa.
 *
 * "Não pediu" é diferente de "negado", e a tela precisa distinguir: um é a
 * ausência de um pedido, o outro é uma decisão que o dono tomou.
 */
export function estadoDoSistema(conta: Conta, app: AppKey): EstadoSistema {
  const grant = conta.grants.find((item) => item.app === app);
  if (!grant) return "nao-pediu";
  if (grant.status === "approved") return "liberado";
  if (grant.status === "pending") return "esperando";
  return "negado";
}

export const rotuloDoSistema: Record<EstadoSistema, string> = {
  liberado: "liberado",
  esperando: "esperando decisão",
  negado: "negado",
  "nao-pediu": "não pediu",
};

/** A decisão mais recente sobre esta pessoa, quando houver. */
export function decididoEm(conta: Conta): string | null {
  const datas = conta.grants.map((grant) => grant.updatedAt).filter((data): data is string => Boolean(data));
  return datas.length ? datas.sort().at(-1)! : null;
}

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

/**
 * As contas em três grupos, na ordem em que pedem atenção.
 *
 * A tela era uma parede de cartões iguais, e o pedido novo se perdia no meio
 * das contas que já estavam resolvidas. Separar pelo estado faz o que pede
 * decisão aparecer primeiro, e o resolvido ficar quieto embaixo.
 */
export function agruparPorEstado(contas: Conta[]): Record<EstadoConta, Conta[]> {
  const grupos: Record<EstadoConta, Conta[]> = { aguardando: [], ativa: [], bloqueada: [] };
  for (const conta of contas) grupos[estadoDaConta(conta)].push(conta);
  return grupos;
}

/** Os sistemas que a pessoa pediu e ainda esperam decisão — é o que a linha resume. */
export function sistemasPedidos(conta: Conta): AppKey[] {
  return conta.grants
    .filter((grant) => grant.app !== "hub" && grant.status === "pending")
    .map((grant) => grant.app as AppKey);
}
