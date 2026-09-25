/**
 * O que a Jade pode fazer no Hub.
 *
 * Ela responde em texto e, quando a frase pede uma ação, devolve também um
 * comando. Este arquivo define quais comandos existem, como reconhecê-los na
 * resposta e o que cada um faz.
 *
 * O LIMITE É A LISTA
 *
 * "Controle total" seria uma IA capaz de apagar o que o Kauã escreveu por
 * interpretar mal uma frase. O que existe aqui é uma lista fechada: fora dela
 * a Jade não alcança nada. Criar e abrir acontecem direto; concluir e apagar
 * passam por confirmação, porque desfazer os dois é trabalho dele, não meu.
 *
 * E ela nunca executa sozinha algo que não foi pedido: o comando só nasce se a
 * resposta trouxer o bloco, e o bloco só aparece quando a pergunta foi um
 * pedido.
 */

export type Acao =
  | { tipo: "criar-atividade"; titulo: string; projeto: string | null }
  | { tipo: "criar-nota"; conteudo: string }
  | { tipo: "concluir-atividade"; titulo: string }
  | { tipo: "abrir"; destino: string };

/** As abas que a Jade pode abrir, pelo nome que ela usa. */
export const destinos: Record<string, string> = {
  "visao-geral": "overview",
  relatorio: "relatorio",
  cursos: "cursos",
  universidades: "university",
  videos: "videos",
  site: "site",
  idiomas: "sat",
  aprovacoes: "approvals",
  configuracoes: "config",
};

/** Ações que mudam ou apagam algo precisam do sim dele antes. */
export function pedeConfirmacao(acao: Acao): boolean {
  return acao.tipo === "concluir-atividade";
}

/** A frase que a confirmação mostra. Diz o efeito, não o nome do comando. */
export function descreverAcao(acao: Acao): string {
  switch (acao.tipo) {
    case "criar-atividade":
      return `Criar a atividade "${acao.titulo}"${acao.projeto ? ` em ${acao.projeto}` : ""}?`;
    case "criar-nota":
      return `Guardar esta nota: "${acao.conteudo.slice(0, 80)}"?`;
    case "concluir-atividade":
      return `Marcar "${acao.titulo}" como concluída?`;
    case "abrir":
      return `Abrir ${acao.destino}?`;
  }
}

/**
 * Tira o bloco de ação da resposta.
 *
 * O formato é um JSON entre marcadores, no fim do texto. Fica separado do que
 * ela escreve para a pessoa: o texto é lido, o bloco é executado, e um não
 * contamina o outro.
 *
 *   <<ACAO>>{"tipo":"criar-atividade","titulo":"Comprar passagem"}<</ACAO>>
 *
 * Devolve o texto limpo e a ação, quando houver. Bloco malformado é descartado
 * em silêncio — errar a execução é pior que não executar, e a resposta em texto
 * continua valendo.
 */
export function separarAcao(resposta: string): { texto: string; acao: Acao | null } {
  const marca = /<<ACAO>>([\s\S]*?)<<\/ACAO>>/;
  const achado = resposta.match(marca);
  if (!achado) return { texto: resposta.trim(), acao: null };

  const texto = resposta.replace(marca, "").trim();
  try {
    const bruto = JSON.parse(achado[1]) as Record<string, unknown>;
    return { texto, acao: validarAcao(bruto) };
  } catch {
    return { texto, acao: null };
  }
}

/**
 * Só passa o que a lista conhece.
 *
 * A resposta de um modelo é dado externo, como qualquer outro. Campo faltando,
 * tipo inventado ou destino fora do mapa viram `null` — e `null` significa que
 * nada acontece, que é o padrão seguro.
 */
export function validarAcao(bruto: Record<string, unknown>): Acao | null {
  const tipo = bruto.tipo;
  const texto = (valor: unknown, max: number): string | null => {
    if (typeof valor !== "string") return null;
    const limpo = valor.trim();
    return limpo ? limpo.slice(0, max) : null;
  };

  if (tipo === "criar-atividade") {
    const titulo = texto(bruto.titulo, 500);
    if (!titulo) return null;
    const projeto = typeof bruto.projeto === "string" ? bruto.projeto.trim() || null : null;
    return { tipo, titulo, projeto };
  }

  if (tipo === "criar-nota") {
    const conteudo = texto(bruto.conteudo, 5000);
    return conteudo ? { tipo, conteudo } : null;
  }

  if (tipo === "concluir-atividade") {
    const titulo = texto(bruto.titulo, 500);
    return titulo ? { tipo, titulo } : null;
  }

  if (tipo === "abrir") {
    const destino = texto(bruto.destino, 40);
    // Destino fora do mapa não abre nada: a Jade não navega para onde quiser.
    return destino && destino in destinos ? { tipo, destino } : null;
  }

  return null;
}

/**
 * A parte do prompt que ensina o formato.
 *
 * Fica junto da definição das ações para as duas nunca se desencontrarem —
 * ensinar um comando que o código não reconhece produz uma Jade que promete e
 * não cumpre.
 */
export const instrucoesDeAcao = `
Você pode agir no Hub. Quando a pessoa pedir uma ação, responda normalmente em
texto e acrescente NO FIM um bloco com o comando:

<<ACAO>>{"tipo":"criar-atividade","titulo":"...","projeto":"videos|sat|university|site|geral"}<</ACAO>>
<<ACAO>>{"tipo":"criar-nota","conteudo":"..."}<</ACAO>>
<<ACAO>>{"tipo":"concluir-atividade","titulo":"..."}<</ACAO>>
<<ACAO>>{"tipo":"abrir","destino":"visao-geral|relatorio|cursos|universidades|videos|site|idiomas|aprovacoes|configuracoes"}<</ACAO>>

Regras:
- Um bloco por resposta, no máximo. Sem bloco quando a pergunta não pede ação.
- Nunca invente o que a pessoa não pediu.
- O texto antes do bloco é o que ela lê: escreva como se o bloco não existisse.
`.trim();
