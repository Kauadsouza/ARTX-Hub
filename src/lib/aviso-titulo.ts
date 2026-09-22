/**
 * O aviso no título da aba.
 *
 * Notificação de verdade — que chega com o navegador fechado — precisa de
 * servidor de e-mail ou push, que este sistema não tem. Prometer isso seria
 * mentir.
 *
 * O que dá para fazer sem servidor nenhum, e que já resolve o caso real: o
 * título da aba. Enquanto o Hub estiver aberto em algum lugar — e ele fica, é
 * a central do dia — o contador aparece ali mesmo com a aba no fundo, ao lado
 * do favicon, na lista de abas e na barra de tarefas.
 *
 * O limite disto está escrito aqui de propósito: se a aba for fechada, nada
 * avisa. É um lembrete passivo, não um alarme.
 */

/** O título original, para poder ser devolvido. */
let titulo = "";

/**
 * Põe ou tira o contador do título.
 *
 * Guarda o título limpo na primeira chamada e sempre parte dele, em vez de
 * empilhar prefixo sobre prefixo — chamar duas vezes seguidas não produz
 * "(2) (2) ARTX Hub".
 */
export function marcarTitulo(quantidade: number): void {
  if (typeof document === "undefined") return;
  if (!titulo) titulo = document.title.replace(/^\(\d+\)\s*/, "");
  document.title = quantidade > 0 ? `(${quantidade}) ${titulo}` : titulo;
}

/** Devolve o título como estava. */
export function limparTitulo(): void {
  if (typeof document === "undefined") return;
  if (titulo) document.title = titulo;
}

/**
 * Texto do aviso do navegador.
 *
 * Separado do disparo para poder ser testado sem precisar de permissão nem de
 * um navegador de verdade.
 */
export function textoDoAviso(vencidos: number, vencendo: number): string | null {
  if (vencidos === 0 && vencendo === 0) return null;
  if (vencidos > 0 && vencendo > 0) {
    return `${vencidos} documento(s) vencido(s) e ${vencendo} vencendo nos próximos dias.`;
  }
  if (vencidos > 0) return `${vencidos} documento(s) já venceram.`;
  return `${vencendo} documento(s) vencendo nos próximos dias.`;
}

/**
 * Mostra um aviso do navegador, se você já tiver permitido.
 *
 * Nunca pede permissão sozinho. Um site que abre a caixa de permissão sem a
 * pessoa ter pedido nada é exatamente o comportamento que faz todo mundo
 * clicar em "bloquear" — e aí o canal morre para sempre.
 */
export function avisarSePermitido(texto: string): boolean {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
  try {
    new Notification("ARTX Hub", { body: texto, tag: "artx-documentos" });
    return true;
  } catch {
    return false;
  }
}

/** Pede a permissão. Só deve ser chamado a partir de um clique da pessoa. */
export async function pedirPermissao(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

/** Se dá para oferecer o aviso: existe API e ainda não foi decidido. */
export function podeOferecer(): boolean {
  return typeof Notification !== "undefined" && Notification.permission === "default";
}
