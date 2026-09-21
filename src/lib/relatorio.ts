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

import { SEMENTE_VERSAO, grupos, idDaSemente, renomeados, semente, type GrupoId } from "./espanha.ts";

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
    novos.push({ id, nome: item.nome, nota: "", feito: false, feitoEm: null, grupo: item.grupo, validade: null });
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

/** Quais grupos têm ao menos um documento, na ordem definida em espanha.ts. */
export function gruposComDocumentos(relatorio: Relatorio): GrupoId[] {
  const presentes = new Set(relatorio.documentos.map((item) => item.grupo));
  return [...presentes].sort(
    (a, b) => grupos.findIndex((g) => g.id === a) - grupos.findIndex((g) => g.id === b),
  );
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
