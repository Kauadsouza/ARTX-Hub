/**
 * Preferências de aparência.
 *
 * Ficam neste navegador, como a escolha de idioma que já existia. Não vão para
 * a conta de propósito: são preferência de tela, e ninguém quer que mudar a cor
 * no computador mude a cor no celular.
 *
 * SOBRE A COR
 *
 * O Hub usa um roxo como cor de ação: botão principal, item ativo do menu,
 * destaque de foco. Ele vive em três variáveis — a cor, uma versão clara para
 * hover e uma transparente para fundo. Trocar as três de uma vez é o que faz a
 * mudança parecer intencional em vez de remendada.
 *
 * SOBRE O TEMA CLARO
 *
 * Não está aqui, e não é esquecimento. O CSS do Hub tem cerca de 500 cores
 * escritas direto na regra, contra 19 em variável — um tema claro exigiria
 * reescrever quase todas. Meio feito, ficaria pior que não ter: texto escuro
 * sobre caixa escura em metade das telas. É um trabalho próprio, não um
 * interruptor.
 */

export const CHAVE_COR = "artx-cor-acento";

export type Acento = {
  id: string;
  nome: string;
  /** A cor cheia: botões e itens ativos. */
  cor: string;
  /** Uma versão mais clara, para hover. */
  clara: string;
  /** A mesma cor transparente, para fundos e anéis de foco. */
  suave: string;
};

/**
 * As opções.
 *
 * Cada uma foi escolhida medindo o contraste do texto branco por cima dela —
 * que é o que se lê no botão principal — e não pelo tom ter ficado bonito.
 * Todas passam de 4,5:1, o mínimo para leitura.
 *
 * O violeta original do Hub dava 3,69:1 e reprovava: o botão mais clicado do
 * sistema tinha o texto mais difícil de ler. Este é o mesmo violeta, um pouco
 * mais fundo, agora em 4,53:1.
 */
export const acentos: Acento[] = [
  { id: "violeta", nome: "Violeta", cor: "#7c60e3", clara: "#9775ff", suave: "rgba(124, 96, 227, 0.16)" },
  { id: "verde", nome: "Verde", cor: "#27845e", clara: "#30a173", suave: "rgba(39, 132, 94, 0.16)" },
  { id: "azul", nome: "Azul", cor: "#3676c5", clara: "#4290f0", suave: "rgba(54, 118, 197, 0.16)" },
  { id: "ambar", nome: "Âmbar", cor: "#9c6d1a", clara: "#be8520", suave: "rgba(156, 109, 26, 0.16)" },
  { id: "rosa", nome: "Rosa", cor: "#bc527b", clara: "#e56496", suave: "rgba(188, 82, 123, 0.16)" },
  { id: "grafite", nome: "Grafite", cor: "#5c6478", clara: "#707a92", suave: "rgba(92, 100, 120, 0.16)" },
];

export const acentoPadrao = acentos[0];

export function acentoPorId(id: string | null): Acento {
  return acentos.find((item) => item.id === id) ?? acentoPadrao;
}

/**
 * Aplica a cor escolhida.
 *
 * Escreve nas mesmas variáveis que o CSS já lê, então toda tela muda junto sem
 * precisar conhecer esta escolha.
 */
export function aplicarAcento(acento: Acento): void {
  if (typeof document === "undefined") return;
  const raiz = document.documentElement.style;
  raiz.setProperty("--violet", acento.cor);
  raiz.setProperty("--violet-bright", acento.clara);
  raiz.setProperty("--violet-soft", acento.suave);
}

export function lerAcentoGuardado(): Acento {
  if (typeof window === "undefined") return acentoPadrao;
  try {
    return acentoPorId(localStorage.getItem(CHAVE_COR));
  } catch {
    return acentoPadrao;
  }
}

export function guardarAcento(acento: Acento): void {
  try {
    localStorage.setItem(CHAVE_COR, acento.id);
  } catch {
    // Navegação privada: a cor vale nesta sessão e não é guardada. Melhor que
    // impedir a troca por causa da gravação.
  }
}

/* ── Validação dos campos da conta ─────────────────────────────────────── */

/**
 * Regras de senha, num lugar só.
 *
 * Estavam espalhadas dentro do componente, em dois `if` soltos. Aqui dá para
 * testá-las e para a mensagem ser a mesma em todo lugar que pedir senha.
 */
export function validarSenha(senha: string, confirmacao: string): string | null {
  if (senha.length < 8) return "Use pelo menos 8 caracteres.";
  if (senha !== confirmacao) return "As senhas não coincidem.";
  return null;
}

/**
 * E-mail plausível.
 *
 * Não tenta validar de verdade — só endereço que o servidor aceitaria existe de
 * verdade, e a confirmação por e-mail é quem prova. Isto só evita o erro de
 * digitação óbvio antes de gastar uma ida ao servidor.
 */
export function validarEmail(email: string): string | null {
  const limpo = email.trim();
  if (!limpo) return "Escreva o e-mail.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(limpo)) return "Esse e-mail não parece completo.";
  return null;
}

export function validarNome(nome: string): string | null {
  const limpo = nome.trim();
  if (limpo.length < 2) return "Escreva ao menos dois caracteres.";
  if (limpo.length > 60) return "Use no máximo 60 caracteres.";
  return null;
}
