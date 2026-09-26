/**
 * Tradução para as funções de biblioteca que produzem texto de tela.
 *
 * O tradutor de verdade mora no React (`useI18n`), e estas funções não
 * podem depender dele: são puras e testadas sem tela. Então quem monta um
 * texto aqui recebe o tradutor como argumento. Sem argumento, o texto sai em
 * português, com os valores já encaixados — que é o que os testes esperam.
 *
 * Os valores entram por `{0}`, `{1}`: "Apagar a conta de {0}?" é uma chave
 * só no catálogo, qualquer que seja o nome. Montar a frase com o nome dentro
 * criaria uma chave por pessoa, e nenhuma teria tradução.
 */
export type Traduzir = (texto: string, valores?: unknown[]) => string;

export const semTraducao: Traduzir = (texto, valores = []) =>
  texto.replace(/\{(\d+)\}/g, (marca, indice: string) =>
    Number(indice) < valores.length ? String(valores[Number(indice)]) : marca,
  );
