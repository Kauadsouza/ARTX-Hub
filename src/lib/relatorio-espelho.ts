/**
 * O espelho do Relatório na conta.
 *
 * O relatório continua morando neste navegador: é lá que ele é lido e escrito,
 * instantaneamente, sem esperar rede. O que muda é que cada alteração também
 * vai para a conta — e ao abrir em qualquer lugar, o que estiver na conta é
 * juntado ao que estiver aqui.
 *
 * NÃO É SINCRONIZAÇÃO COM DONO ÚNICO
 *
 * Os dois lados são juntados por `unir`, que nunca sobrescreve: item que já
 * existe fica como está, item que falta entra, e um desfecho já registrado não
 * volta a ficar pendente por causa de uma cópia antiga. Isso torna o conflito
 * impossível de causar perda — no pior caso sobra informação, nunca falta.
 *
 * DEGRADA EM VOZ ALTA
 *
 * Sem login, sem rede, ou com a migração do banco ainda não aplicada, o
 * relatório funciona igual e a tela diz que a cópia na conta não está ativa.
 * Um espelho que falha calado é pior que não ter espelho: a pessoa passa a
 * confiar numa proteção que não existe.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { ler, relatorioVazio, unir, type Relatorio } from "./relatorio.ts";
import { semTraducao, type Traduzir } from "./traducao.ts";

/** Chave do payload dentro de `hub_app_state`. */
const APP = "relatorio";
const PERFIL = "kaua";

export type EstadoEspelho =
  /** Ainda não tentamos. */
  | { tipo: "iniciando" }
  /** Copiado para a conta, com a hora da última vez. */
  | { tipo: "guardado"; quando: string }
  /** Funciona, mas só neste aparelho — e por quê. */
  | { tipo: "so-local"; motivo: string }
  /** Falhou agora; vai tentar de novo na próxima alteração. */
  | { tipo: "falhou"; motivo: string };

/**
 * A migração que falta, traduzida.
 *
 * O Postgres recusa um `app` fora da lista com erro de constraint. Quando isso
 * acontece, a causa é conhecida e a mensagem crua não ajuda ninguém.
 */
function traduzir(erro: { message?: string; code?: string } | null): string {
  const texto = erro?.message ?? "";
  if (/hub_app_state_app_check|violates check constraint/i.test(texto)) {
    return "Falta rodar supabase/relatorio-state.sql no banco para a conta aceitar este relatório.";
  }
  if (erro?.code === "40001" || /Newer progress exists/i.test(texto)) {
    return "Outra aba gravou primeiro. Vou juntar as duas na próxima abertura.";
  }
  if (/Authentication required|JWT|401/i.test(texto)) return "Entre na conta para guardar a cópia.";
  return texto || "Não consegui falar com a conta agora.";
}

type Linha = { payload: unknown; revision: number };

/**
 * Lê a cópia da conta e junta com a daqui.
 *
 * Devolve o relatório unido e a revisão, que a gravação precisa para não
 * atropelar o que outro aparelho escreveu.
 */
export async function puxar(
  supabase: SupabaseClient | null,
  local: Relatorio,
): Promise<{ relatorio: Relatorio; revisao: number; estado: EstadoEspelho }> {
  if (!supabase) {
    return { relatorio: local, revisao: 0, estado: { tipo: "so-local", motivo: "Conta não configurada neste ambiente." } };
  }

  const { data, error } = await supabase
    .from("hub_app_state")
    .select("payload,revision")
    .eq("app", APP)
    .eq("profile", PERFIL)
    .maybeSingle();

  if (error) {
    return { relatorio: local, revisao: 0, estado: { tipo: "so-local", motivo: traduzir(error) } };
  }

  const linha = data as Linha | null;
  if (!linha) {
    // Ainda não há cópia: o que está aqui vira a primeira.
    return { relatorio: local, revisao: 0, estado: { tipo: "iniciando" } };
  }

  const remoto = ler(JSON.stringify(linha.payload ?? {}));
  const { relatorio } = unir(local, remoto);
  return { relatorio, revisao: linha.revision, estado: { tipo: "guardado", quando: new Date().toISOString() } };
}

/**
 * Manda a cópia para a conta.
 *
 * Usa a mesma função do banco que o resto do Hub usa, com a revisão que veio
 * na leitura. Se outro aparelho gravou no meio, o banco recusa — e recusar é o
 * certo: a próxima abertura junta os dois lados em vez de um apagar o outro.
 */
export async function empurrar(
  supabase: SupabaseClient | null,
  relatorio: Relatorio,
  revisao: number,
): Promise<{ revisao: number; estado: EstadoEspelho }> {
  if (!supabase) {
    return { revisao, estado: { tipo: "so-local", motivo: "Conta não configurada neste ambiente." } };
  }

  const { data, error } = await supabase.rpc("save_hub_app_state", {
    p_app: APP,
    p_profile: PERFIL,
    p_payload: relatorio,
    p_revision: revisao,
  });

  if (error) {
    return { revisao, estado: { tipo: "falhou", motivo: traduzir(error) } };
  }
  return { revisao: typeof data === "number" ? data : revisao + 1, estado: { tipo: "guardado", quando: new Date().toISOString() } };
}

/** Frase curta para a tela, sem jargão. */
export function descrever(estado: EstadoEspelho, traduzirTela: Traduzir = semTraducao): string {
  switch (estado.tipo) {
    case "iniciando":
      return traduzirTela("Preparando a cópia na conta…");
    case "guardado":
      return traduzirTela("Cópia guardada na sua conta.");
    case "so-local":
      return traduzirTela("Só neste aparelho. {0}", [traduzirTela(estado.motivo)]);
    case "falhou":
      return traduzirTela("A cópia não subiu. {0}", [traduzirTela(estado.motivo)]);
  }
}

/** Se o estado significa que os dados estão protegidos fora deste navegador. */
export function protegido(estado: EstadoEspelho): boolean {
  return estado.tipo === "guardado";
}

/** Relatório vazio tipado, para quem importa só daqui. */
export { relatorioVazio };
