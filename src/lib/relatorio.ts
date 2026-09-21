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
};

export type Relatorio = {
  version: 1;
  anotacoes: Anotacao[];
  documentos: Documento[];
};

export function relatorioVazio(): Relatorio {
  return { version: 1, anotacoes: [], documentos: [] };
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

export function criarDocumento(nome: string, nota = ""): Documento | null {
  const texto = nome.trim();
  if (!texto) return null;
  return { id: novoId(), nome: texto.slice(0, 200), nota: nota.trim().slice(0, 1000), feito: false, feitoEm: null };
}

export function alternarDocumento(documento: Documento, agora = new Date()): Documento {
  const feito = !documento.feito;
  return { ...documento, feito, feitoEm: feito ? agora.toISOString() : null };
}

export function progressoDocumentos(documentos: Documento[]): { feitos: number; total: number; fracao: number } {
  const feitos = documentos.filter((item) => item.feito).length;
  return { feitos, total: documentos.length, fracao: documentos.length ? feitos / documentos.length : 0 };
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
    return {
      version: 1,
      anotacoes: Array.isArray(anotacoes) ? anotacoes.filter(ehAnotacao) : [],
      documentos: Array.isArray(documentos) ? documentos.filter(ehDocumento) : [],
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
  return typeof d.id === "string" && typeof d.nome === "string" && typeof d.feito === "boolean";
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

  return { relatorio: { version: 1, anotacoes: [...anotacoes.values()], documentos: [...documentos.values()] }, novas };
}
