/**
 * O relatório do Kauã.
 *
 * Duas coisas: anotações que vivem sete dias e somem sozinhas, e a lista de
 * documentos para a Espanha.
 *
 * Tudo mora neste aparelho. Não há API, não há conta, não há servidor — foi o
 * pedido, e tem uma consequência que a tela precisa dizer em voz alta: limpar
 * os dados do navegador apaga isto junto. Por isso existe exportar.
 *
 * SOBRE APAGAR SOZINHO
 *
 * Um sistema que apaga o que você escreveu é uma coisa séria, mesmo quando foi
 * você que pediu. Três decisões saem daí:
 *
 *   1. A anotação morre no FIM do sétimo dia, não sete vezes vinte e quatro
 *      horas depois de criada. Escrever às 23h e ver sumir às 23h de um dia
 *      qualquer é o tipo de surpresa que faz perder confiança na ferramenta.
 *   2. O prazo aparece em cada anotação, sempre. Nada some sem ter avisado
 *      quantos dias faltavam.
 *   3. Dá para renovar. Sete dias é o padrão, não uma armadilha — se a
 *      anotação ainda importa no sexto dia, um clique devolve a semana.
 */

import { SEMENTE_VERSAO, idDaSemente, renomeados, semente, type GrupoId } from "./espanha.ts";

export const DIAS_DE_VIDA = 7;

export type Anotacao = {
  id: string;
  titulo: string;
  descricao: string;
  /** ISO completo: quando foi escrita. */
  criadaEm: string;
  /** Só a data (AAAA-MM-DD). A anotação vive o dia inteiro e sai no fim dele. */
  expiraEm: string;
  /** Quantas vezes o prazo foi renovado. */
  renovacoes: number;
};

export type Documento = {
  id: string;
  nome: string;
  nota: string;
  feito: boolean;
  /** Quando foi marcado como feito, para você saber desde quando está pronto. */
  feitoEm: string | null;
  grupo: GrupoId;
  /**
   * Até quando este documento vale (AAAA-MM-DD), quando tiver prazo.
   *
   * Quem preenche é você. Antecedentes criminais e certidões costumam precisar
   * ser recentes, mas o prazo varia por consulado e por documento — eu não sei
   * qual é, e chutar aqui seria pior que deixar em branco.
   */
  validade: string | null;
};

/** Aviso a partir daqui. Um mês dá tempo de tirar segunda via. */
export const AVISO_DE_VENCIMENTO = 30;

export type EstadoValidade = "sem-prazo" | "em-dia" | "vencendo" | "vencido";

/** Dias de calendário até vencer. Null quando o documento não tem prazo. */
export function diasParaVencer(documento: Documento, agora = new Date()): number | null {
  if (!documento.validade) return null;
  const [ano, mes, dia] = documento.validade.split("-").map(Number);
  if (!ano || !mes || !dia) return null;
  const fim = Date.UTC(ano, mes - 1, dia);
  const hoje = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate());
  return Math.round((fim - hoje) / 86_400_000);
}

/**
 * Em que pé está a validade.
 *
 * Um documento vencido continua marcado como feito: você realmente o tirou, e
 * desmarcar sozinho seria reescrever o que você registrou. O que muda é o
 * alerta na tela — a decisão de renovar é sua.
 */
export function estadoValidade(documento: Documento, agora = new Date()): EstadoValidade {
  const dias = diasParaVencer(documento, agora);
  if (dias === null) return "sem-prazo";
  if (dias < 0) return "vencido";
  if (dias <= AVISO_DE_VENCIMENTO) return "vencendo";
  return "em-dia";
}

export function definirValidade(documento: Documento, validade: string | null): Documento {
  // String vazia vinda de um campo de data limpo significa "sem prazo".
  return { ...documento, validade: validade && validade.trim() ? validade : null };
}

/** Os que precisam de atenção, dos mais urgentes para os menos. */
export function precisamAtencao(documentos: Documento[], agora = new Date()): Documento[] {
  return documentos
    .filter((item) => {
      const estado = estadoValidade(item, agora);
      return estado === "vencido" || estado === "vencendo";
    })
    .sort((a, b) => (diasParaVencer(a, agora) ?? 0) - (diasParaVencer(b, agora) ?? 0));
}

export type Relatorio = {
  version: 1;
  anotacoes: Anotacao[];
  documentos: Documento[];
  /** Até que versão da lista da Espanha já foi semeada aqui. */
  sementeVersao: number;
  /** Itens da semente que o Kauã apagou. Semear de novo não os traz de volta. */
  dispensados: string[];
};

export function relatorioVazio(): Relatorio {
  return { version: 1, anotacoes: [], documentos: [], sementeVersao: 0, dispensados: [] };
}

/** Data local em AAAA-MM-DD. Não usa ISO/UTC: o dia é o do relógio daqui. */
export function diaLocal(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function somarDias(data: Date, dias: number): Date {
  const nova = new Date(data);
  nova.setDate(nova.getDate() + dias);
  return nova;
}

/**
 * Dias de calendário que faltam, não horas decorridas.
 *
 * Contar horas diria "0 dias" para algo que vence amanhã de manhã, porque
 * faltam 0,4 dia. Aqui a comparação é entre datas: vence hoje é 0, amanhã é 1,
 * a qualquer hora do dia.
 */
export function diasRestantes(anotacao: Anotacao, agora = new Date()): number {
  const [ano, mes, dia] = anotacao.expiraEm.split("-").map(Number);
  const fim = Date.UTC(ano, mes - 1, dia);
  const hoje = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate());
  return Math.round((fim - hoje) / 86_400_000);
}

export function expirou(anotacao: Anotacao, agora = new Date()): boolean {
  return diasRestantes(anotacao, agora) < 0;
}

/** Identificador sem depender de crypto, que nem sempre existe. */
function novoId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function criarAnotacao(titulo: string, descricao = "", agora = new Date()): Anotacao | null {
  const nome = titulo.trim();
  if (!nome) return null; // Sem título não é anotação, é linha em branco.
  return {
    id: novoId(),
    titulo: nome.slice(0, 200),
    descricao: descricao.trim().slice(0, 5000),
    criadaEm: agora.toISOString(),
    expiraEm: diaLocal(somarDias(agora, DIAS_DE_VIDA)),
    renovacoes: 0,
  };
}

/** Devolve a semana inteira a partir de hoje. */
export function renovar(anotacao: Anotacao, agora = new Date()): Anotacao {
  return {
    ...anotacao,
    expiraEm: diaLocal(somarDias(agora, DIAS_DE_VIDA)),
    renovacoes: anotacao.renovacoes + 1,
  };
}

/**
 * Tira o que passou do prazo e diz o que tirou.
 *
 * Devolve as removidas junto porque a tela precisa contar o que aconteceu. Uma
 * anotação que some sem deixar rastro parece um bug, não uma regra.
 */
export function expurgar(
  relatorio: Relatorio,
  agora = new Date(),
): { relatorio: Relatorio; removidas: Anotacao[] } {
  const removidas = relatorio.anotacoes.filter((item) => expirou(item, agora));
  if (removidas.length === 0) return { relatorio, removidas: [] };
  return {
    relatorio: { ...relatorio, anotacoes: relatorio.anotacoes.filter((item) => !expirou(item, agora)) },
    removidas,
  };
}

/** As mais perto de vencer primeiro: são as que precisam de decisão. */
export function porUrgencia(anotacoes: Anotacao[], agora = new Date()): Anotacao[] {
  return [...anotacoes].sort((a, b) => diasRestantes(a, agora) - diasRestantes(b, agora));
}

/* ── Documentos ────────────────────────────────────────────────────────── */

export function criarDocumento(nome: string, nota = "", grupo: GrupoId = "meus"): Documento | null {
  const texto = nome.trim();
  if (!texto) return null;
  return { id: novoId(), nome: texto.slice(0, 200), nota: nota.trim().slice(0, 1000), feito: false, feitoEm: null, grupo, validade: null };
}

/**
 * A observação do documento.
 *
 * É onde cabe o que só você sabe: o valor que o consulado pediu, onde tirar a
 * segunda via, o número do protocolo. O campo existia no modelo desde o começo
 * e nunca aparecia na tela — guardava a informação e não a mostrava a ninguém.
 */
export function definirNota(documento: Documento, nota: string): Documento {
  return { ...documento, nota: nota.slice(0, 1000) };
}

export function alternarDocumento(documento: Documento, agora = new Date()): Documento {
  const feito = !documento.feito;
  return { ...documento, feito, feitoEm: feito ? agora.toISOString() : null };
}

export function progressoDocumentos(documentos: Documento[]): { feitos: number; total: number; fracao: number } {
  const feitos = documentos.filter((item) => item.feito).length;
  return { feitos, total: documentos.length, fracao: documentos.length ? feitos / documentos.length : 0 };
}

/**
 * Põe a lista da Espanha no relatório, sem atropelar nada.
 *
 * Três regras, todas pela mesma razão — o que o Kauã fez aqui vale mais que a
 * lista de origem:
 *
 *   1. Item que já existe não é duplicado nem reescrito. O id vem do grupo e do
 *      nome, então ele é o mesmo em qualquer aparelho e em qualquer execução.
 *   2. Item que ele apagou não volta. Fica registrado em `dispensados`, e nem
 *      uma versão nova da semente o traz de novo.
 *   3. Semear duas vezes não muda nada na segunda.
 */
export function semear(relatorio: Relatorio): { relatorio: Relatorio; adicionados: number } {
  if (relatorio.sementeVersao >= SEMENTE_VERSAO) return { relatorio, adicionados: 0 };

  // Renomear vem antes de acrescentar: o item renomeado já existe, e se o novo
  // nome fosse tratado como item novo a lista ficaria com os dois.
  const atuais = relatorio.documentos.map((item) => {
    const troca = renomeados.find((r) => r.id === item.id);
    if (!troca) return item;
    return { ...item, nome: troca.nome, nota: troca.nota ?? item.nota };
  });

  const existentes = new Set(atuais.map((item) => item.id));
  const dispensados = new Set(relatorio.dispensados);
  const novos: Documento[] = [];

  for (const item of semente) {
    const id = idDaSemente(item.grupo, item.nome);
    if (existentes.has(id) || dispensados.has(id)) continue;
    // Um item que só mudou de nome já foi tratado acima e não entra de novo.
    if (renomeados.some((r) => r.nome === item.nome && existentes.has(r.id))) continue;
    novos.push({ id, nome: item.nome, nota: item.nota ?? "", feito: false, feitoEm: null, grupo: item.grupo, validade: null });
  }

  return {
    relatorio: { ...relatorio, documentos: [...atuais, ...novos], sementeVersao: SEMENTE_VERSAO },
    adicionados: novos.length,
  };
}

/**
 * Remove um documento. Se veio da semente, anota para não voltar.
 *
 * Sem isto, apagar um item seria inútil: a próxima versão da lista o traria de
 * volta, e a pessoa teria que apagar de novo.
 */
export function removerDocumento(relatorio: Relatorio, id: string): Relatorio {
  const daSemente = id.includes(":");
  return {
    ...relatorio,
    documentos: relatorio.documentos.filter((item) => item.id !== id),
    dispensados: daSemente && !relatorio.dispensados.includes(id) ? [...relatorio.dispensados, id] : relatorio.dispensados,
  };
}

/** Os documentos de um grupo, na ordem em que entraram. */
export function documentosDoGrupo(relatorio: Relatorio, grupo: GrupoId): Documento[] {
  return relatorio.documentos.filter((item) => item.grupo === grupo);
}

/* ── Guardar e ler ─────────────────────────────────────────────────────── */

export const CHAVE = "artx-relatorio-kaua-v1";

/** Lê sem confiar no formato do que vier. Lixo vira relatório vazio. */
export function ler(bruto: string | null): Relatorio {
  if (!bruto) return relatorioVazio();
  try {
    const dados = JSON.parse(bruto) as unknown;
    if (!dados || typeof dados !== "object") return relatorioVazio();
    const { anotacoes, documentos } = dados as { anotacoes?: unknown; documentos?: unknown };
    const { sementeVersao, dispensados } = dados as { sementeVersao?: unknown; dispensados?: unknown };
    return {
      version: 1,
      anotacoes: Array.isArray(anotacoes) ? anotacoes.filter(ehAnotacao) : [],
      documentos: Array.isArray(documentos) ? documentos.filter(ehDocumento) : [],
      sementeVersao: typeof sementeVersao === "number" ? sementeVersao : 0,
      dispensados: Array.isArray(dispensados) ? dispensados.filter((item): item is string => typeof item === "string") : [],
    };
  } catch {
    return relatorioVazio();
  }
}

function ehAnotacao(valor: unknown): valor is Anotacao {
  if (!valor || typeof valor !== "object") return false;
  const a = valor as Partial<Anotacao>;
  return typeof a.id === "string" && typeof a.titulo === "string" && typeof a.expiraEm === "string";
}

function ehDocumento(valor: unknown): valor is Documento {
  if (!valor || typeof valor !== "object") return false;
  const d = valor as Partial<Documento>;
  if (typeof d.id !== "string" || typeof d.nome !== "string" || typeof d.feito !== "boolean") return false;
  // Documento guardado antes dos grupos existirem cai em "meus" em vez de
  // sumir da tela por não ter um campo que ainda não havia.
  if (typeof d.grupo !== "string") d.grupo = "meus";
  if (typeof d.validade !== "string") d.validade = null;
  return true;
}

/**
 * Resumo para outras telas.
 *
 * A Visão geral precisa saber se há documento vencendo sem ter que conhecer o
 * formato inteiro do relatório. Lê, não escreve — e devolve zeros quando não há
 * nada guardado, em vez de explodir.
 */
export function resumoParaOHub(bruto: string | null, agora = new Date()): {
  vencendo: number;
  vencidos: number;
  proximo: { nome: string; dias: number } | null;
} {
  const relatorio = ler(bruto);
  const alerta = precisamAtencao(relatorio.documentos, agora);
  const vencidos = alerta.filter((item) => estadoValidade(item, agora) === "vencido").length;
  const primeiro = alerta[0];
  return {
    vencendo: alerta.length - vencidos,
    vencidos,
    proximo: primeiro ? { nome: primeiro.nome, dias: diasParaVencer(primeiro, agora) ?? 0 } : null,
  };
}

/**
 * O relatório como itens de busca.
 *
 * A paleta do Hub já achava atividades e notas, mas não enxergava nada daqui —
 * e é aqui que estão a checklist da Espanha e as anotações da semana. Procurar
 * "passaporte" e não achar o item que se chama exatamente isso é o tipo de
 * falha que faz a pessoa parar de usar a busca.
 *
 * Só lê. Devolve o texto e para onde ir; quem monta o comando é a paleta.
 */
export function itensParaBusca(bruto: string | null, agora = new Date()): Array<{
  id: string;
  grupo: "Anotações" | "Documentos";
  texto: string;
  detalhe: string;
}> {
  const relatorio = ler(bruto);
  const itens: Array<{ id: string; grupo: "Anotações" | "Documentos"; texto: string; detalhe: string }> = [];

  for (const nota of relatorio.anotacoes) {
    const dias = diasRestantes(nota, agora);
    itens.push({
      id: `relatorio-nota-${nota.id}`,
      grupo: "Anotações",
      // A descrição entra na busca junto do título: quem lembra do conteúdo e
      // não do nome ainda encontra.
      texto: nota.descricao ? `${nota.titulo} — ${nota.descricao}` : nota.titulo,
      detalhe: dias <= 0 ? "vence hoje" : `${dias} dia${dias > 1 ? "s" : ""}`,
    });
  }

  for (const doc of relatorio.documentos) {
    const estado = estadoValidade(doc, agora);
    itens.push({
      id: `relatorio-doc-${doc.id}`,
      grupo: "Documentos",
      texto: doc.nota ? `${doc.nome} — ${doc.nota}` : doc.nome,
      detalhe: doc.feito ? "pronto" : estado === "vencido" ? "vencido" : estado === "vencendo" ? "vencendo" : "pendente",
    });
  }

  return itens;
}

/**
 * Junta um arquivo importado ao que já existe, sem perder nada.
 *
 * Nada é sobrescrito: o que tem o mesmo id fica como está aqui. Um documento já
 * marcado como feito não volta a ficar pendente por causa de um arquivo antigo.
 */
export function unir(atual: Relatorio, importado: Relatorio): { relatorio: Relatorio; novas: number } {
  const anotacoes = new Map(atual.anotacoes.map((item) => [item.id, item]));
  const documentos = new Map(atual.documentos.map((item) => [item.id, item]));
  let novas = 0;

  for (const item of importado.anotacoes) {
    if (!anotacoes.has(item.id)) {
      anotacoes.set(item.id, item);
      novas++;
    }
  }
  for (const item of importado.documentos) {
    const existente = documentos.get(item.id);
    if (!existente) {
      documentos.set(item.id, item);
      novas++;
    } else if (!existente.feito && item.feito) {
      documentos.set(item.id, { ...existente, feito: true, feitoEm: item.feitoEm });
    }
  }

  return {
    relatorio: {
      version: 1,
      anotacoes: [...anotacoes.values()],
      documentos: [...documentos.values()],
      // Fica a maior das duas versões: semear de novo o que o arquivo já tinha
      // não acrescentaria nada, e os dispensados dos dois lados se somam para
      // que nenhum item apagado volte por causa de um import.
      sementeVersao: Math.max(atual.sementeVersao, importado.sementeVersao),
      dispensados: [...new Set([...atual.dispensados, ...importado.dispensados])],
    },
    novas,
  };
}

/**
 * Uma anotação nova, gravada direto no Relatório guardado neste navegador.
 *
 * É por aqui que a Jade guarda uma nota. O bloco de notas da Visão geral saiu
 * — as notas vivem no Relatório —, e a nota da Jade ia para uma tabela que
 * nenhuma tela mostrava mais: dava para criar e não dava para ver.
 *
 * Grava no mesmo lugar em que o Relatório lê. Da próxima vez que ele abrir,
 * junta esta anotação com a cópia da conta e sobe as duas, como faz com
 * qualquer anotação escrita offline.
 */
export function anotarNoRelatorio(bruto: string | null, titulo: string, agora = new Date()): { relatorio: Relatorio; anotacao: Anotacao } | null {
  const anotacao = criarAnotacao(titulo, "", agora);
  if (!anotacao) return null;
  const atual = ler(bruto);
  return { relatorio: { ...atual, anotacoes: [anotacao, ...atual.anotacoes] }, anotacao };
}
