/**
 * Documentação para a Espanha.
 *
 * A lista veio do Kauã, não de pesquisa minha. Isso importa e a tela diz: são
 * requisitos que mudam por consulado, por curso e por categoria de vaga, e a
 * lista vigente tem que ser conferida antes de pagar tradução, apostila ou taxa.
 * Um app que apresentasse isto como verificado estaria mentindo.
 *
 * A separação em grupos é o que a lista tem de mais útil. "46 documentos" não
 * ajuda ninguém; "o que eu já posso resolver hoje" e "o que só existe depois de
 * eu ter uma oferta" são duas perguntas diferentes, e cada caminho de visto
 * responde de um jeito.
 */

export type GrupoId = "base" | "apostila" | "estudante" | "trabalho" | "nomade" | "meus";

export type Grupo = {
  id: GrupoId;
  titulo: string;
  /** Uma linha sobre o que este grupo é. */
  resumo: string;
  /** Se dá para adiantar isto hoje, sem depender de ninguém. */
  agora: boolean;
  /** O que precisa acontecer fora daqui antes de o grupo fazer sentido. */
  depende: string[];
};

export const grupos: Grupo[] = [
  {
    id: "base",
    titulo: "Documentos pessoais",
    resumo: "Serve para qualquer um dos três caminhos. É o que dá para resolver no Brasil antes de ter qualquer oportunidade.",
    agora: true,
    depende: [],
  },
  {
    id: "apostila",
    titulo: "Apostila de Haia e tradução",
    resumo: "Não é uma lista de documentos, é uma lista de checagens antes de gastar dinheiro.",
    agora: true,
    depende: [],
  },
  {
    id: "estudante",
    titulo: "Visto de estudante",
    resumo: "Estudar na Espanha e, dentro das regras da autorização, trabalhar enquanto estuda — em geral até 30h por semana.",
    agora: false,
    depende: [
      "Escolher e ser aceito em um curso elegível — não basta um curso qualquer.",
      "Comprovar recursos financeiros suficientes.",
      "Contratar o seguro de saúde exigido.",
    ],
  },
  {
    id: "trabalho",
    titulo: "Visto de trabalho",
    resumo: "Uma empresa espanhola contrata você e inicia a autorização antes de você pedir o visto no Brasil.",
    agora: false,
    depende: [
      "Uma empresa espanhola disposta a contratar e patrocinar.",
      "Aprovação da autorização inicial de residência e trabalho.",
      "Contrato e documentação emitidos pela empresa.",
      "Conseguir a oferta não garante a autorização: a situação do mercado e a categoria da vaga pesam.",
    ],
  },
  {
    id: "nomade",
    titulo: "Visto de nômade digital",
    resumo: "Trabalho remoto para empresas ou clientes de fora da Espanha. Não serve para chegar e procurar emprego presencial.",
    agora: false,
    depende: [
      "Ter um trabalho remoto elegível antes de começar o pedido.",
      "Comprovar pelo menos três meses de vínculo profissional.",
      "Cumprir os requisitos de renda e de qualificação.",
    ],
  },
  {
    id: "meus",
    titulo: "Meus acréscimos",
    resumo: "O que você adicionar fica aqui.",
    agora: true,
    depende: [],
  },
];

export function grupoPorId(id: GrupoId): Grupo {
  return grupos.find((item) => item.id === id) ?? grupos[grupos.length - 1];
}

/**
 * A semente.
 *
 * Sobe a versão quando itens novos entram. Subir não ressuscita o que o Kauã
 * apagou: os dispensados ficam guardados no relatório dele.
 */
export const SEMENTE_VERSAO = 1;

export const semente: Array<{ grupo: GrupoId; nome: string }> = [
  // ── Pessoais, válidos para qualquer caminho ──────────────────────────
  { grupo: "base", nome: "Passaporte brasileiro válido" },
  { grupo: "base", nome: "RG ou CIN em bom estado" },
  { grupo: "base", nome: "CPF regularizado" },
  { grupo: "base", nome: "Certidão de nascimento atualizada" },
  { grupo: "base", nome: "Histórico escolar do ensino médio" },
  { grupo: "base", nome: "Certificado de conclusão do ensino médio" },
  { grupo: "base", nome: "Currículo em espanhol" },
  { grupo: "base", nome: "Comprovantes de experiência profissional e cursos" },
  { grupo: "base", nome: "Carteira de vacinação e registros médicos, se solicitados" },
  { grupo: "base", nome: "Comprovante de endereço no Brasil" },

  // ── Antes de gastar com apostila e tradução ──────────────────────────
  { grupo: "apostila", nome: "Verificar quais documentos precisam de Apostila de Haia" },
  { grupo: "apostila", nome: "Providenciar tradução juramentada para o espanhol onde for exigida" },
  { grupo: "apostila", nome: "Conferir se a autoridade aceita cópia ou exige o original" },
  { grupo: "apostila", nome: "Não apostilar tudo de uma vez: certidão com prazo de validade precisa ser recente" },

  // ── Visto de estudante ───────────────────────────────────────────────
  { grupo: "estudante", nome: "Passaporte válido" },
  { grupo: "estudante", nome: "Formulário de solicitação do visto nacional" },
  { grupo: "estudante", nome: "Fotografia recente no padrão exigido" },
  { grupo: "estudante", nome: "Carta de admissão de instituição ou curso elegível" },
  { grupo: "estudante", nome: "Comprovante de matrícula ou pagamento, quando exigido" },
  { grupo: "estudante", nome: "Comprovação de recursos financeiros suficientes" },
  { grupo: "estudante", nome: "Seguro de saúde válido na Espanha" },
  { grupo: "estudante", nome: "Comprovante de alojamento, se solicitado" },
  { grupo: "estudante", nome: "Atestado médico, quando exigido" },
  { grupo: "estudante", nome: "Certificado de antecedentes criminais, quando exigido" },
  { grupo: "estudante", nome: "Comprovante de residência na jurisdição consular" },
  { grupo: "estudante", nome: "Comprovantes de escolaridade, se exigidos pelo curso" },
  { grupo: "estudante", nome: "Taxa consular e formulários adicionais" },

  // ── Visto de trabalho ────────────────────────────────────────────────
  { grupo: "trabalho", nome: "Passaporte válido" },
  { grupo: "trabalho", nome: "Formulário de visto nacional" },
  { grupo: "trabalho", nome: "Fotografia recente" },
  { grupo: "trabalho", nome: "Contrato ou oferta formal de emprego" },
  { grupo: "trabalho", nome: "Autorização inicial de residência e trabalho aprovada" },
  { grupo: "trabalho", nome: "Certificado de antecedentes criminais" },
  { grupo: "trabalho", nome: "Atestado médico, conforme exigência" },
  { grupo: "trabalho", nome: "Comprovante de residência no Brasil" },
  { grupo: "trabalho", nome: "Formulários e comprovantes de pagamento das taxas" },
  { grupo: "trabalho", nome: "Diplomas ou comprovação profissional, se exigidos para a vaga" },

  // ── Visto de nômade digital ──────────────────────────────────────────
  { grupo: "nomade", nome: "Passaporte válido" },
  { grupo: "nomade", nome: "Formulário de visto nacional" },
  { grupo: "nomade", nome: "Fotografia recente" },
  { grupo: "nomade", nome: "Contrato de trabalho remoto ou contratos com clientes estrangeiros" },
  { grupo: "nomade", nome: "Declaração da empresa autorizando o trabalho remoto desde a Espanha" },
  { grupo: "nomade", nome: "Comprovante de vínculo profissional de pelo menos 3 meses" },
  { grupo: "nomade", nome: "Comprovantes de renda e extratos bancários" },
  { grupo: "nomade", nome: "Comprovação de qualificação profissional ou experiência exigida" },
  { grupo: "nomade", nome: "Documentos de registro e atividade da empresa contratante" },
  { grupo: "nomade", nome: "Certificado de antecedentes criminais" },
  { grupo: "nomade", nome: "Atestado médico, conforme exigência" },
  { grupo: "nomade", nome: "Seguro de saúde ou cobertura válida exigida" },
  { grupo: "nomade", nome: "Comprovante de residência e taxas consulares" },
];

/**
 * Identificador estável de um item da semente.
 *
 * Precisa ser o mesmo entre execuções e entre aparelhos, senão semear de novo
 * duplicaria a lista inteira. Vem do grupo mais o nome, sem acento e sem
 * pontuação — mudar a pontuação de um nome não pode criar um item novo.
 */
export function idDaSemente(grupo: GrupoId, nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${grupo}:${limpo}`;
}
