/**
 * Preferências de aparência.
 *
 * Ficam neste navegador, como a escolha de idioma. Não vão para a conta de
 * propósito: é preferência de tela, e ninguém quer que o tema do computador
 * mude o do celular.
 *
 * SOBRE OS TEMAS
 *
 * Até aqui havia uma cor de destaque, e um tema claro era impossível: o CSS
 * tinha 453 cores escritas direto nas regras. Elas viraram variáveis — cada
 * uma classificada pelo papel que cumpre, não pelo tom — e agora um tema troca
 * só as cores de base; linhas, realces, painéis e gráficos derivam delas. Por
 * isso um tema muda o Hub inteiro sem precisar conhecer nenhuma tela.
 *
 * O seletor de cor saiu, e não só da tela: ele escrevia a cor direto no
 * <html> como estilo, e estilo direto passa por cima de qualquer regra do
 * CSS. Com ele ligado, nenhum tema conseguiria trocar o acento.
 */

export const CHAVE_TEMA = "artx-tema";

export type Tema = {
  id: "noite" | "oceano" | "claro" | "areia";
  nome: string;
  descricao: string;
  /** As três cores que representam o tema na amostra: fundo, superfície, acento. */
  amostra: [string, string, string];
};

/**
 * As opções.
 *
 * O acento de cada uma foi conferido com o validador de paleta contra o
 * próprio fundo, e o texto em cima do botão principal passa de 4,5:1 em
 * todas. O de Oceano é um ciano claro demais para texto branco, então lá o
 * texto do botão é escuro — é para isso que a variável `--sobre-acento` existe.
 */
export const temas: Tema[] = [
  { id: "noite", nome: "Noite", descricao: "Escuro, com roxo. O de sempre.", amostra: ["#07080d", "#151823", "#7c60e3"] },
  { id: "oceano", nome: "Oceano", descricao: "Azul-marinho fundo, com ciano.", amostra: ["#050e19", "#101f31", "#1b9ad6"] },
  { id: "claro", nome: "Claro", descricao: "Branco e limpo, para o dia.", amostra: ["#f3f5f9", "#ffffff", "#6547dc"] },
  { id: "areia", nome: "Areia", descricao: "Claro e quente, com índigo.", amostra: ["#f4eee3", "#fffcf6", "#4e43c4"] },
];

export const temaPadrao = temas[0];

export function temaPorId(id: string | null): Tema {
  return temas.find((item) => item.id === id) ?? temaPadrao;
}

/** Aplica o tema: o CSS lê `data-tema` no <html> e troca as cores de base. */
export function aplicarTema(tema: Tema): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.tema = tema.id;
}

export function lerTemaGuardado(): Tema {
  if (typeof window === "undefined") return temaPadrao;
  try {
    return temaPorId(localStorage.getItem(CHAVE_TEMA));
  } catch {
    return temaPadrao;
  }
}

export function guardarTema(tema: Tema): void {
  try {
    localStorage.setItem(CHAVE_TEMA, tema.id);
    // A cor de destaque antiga não serve mais para nada. Fica sem dono se
    // não for limpa.
    localStorage.removeItem("artx-cor-acento");
  } catch {
    // Navegação privada: o tema vale nesta sessão e não é guardado.
  }
}

/**
 * O script que aplica o tema antes da primeira pintura.
 *
 * Sem ele, a página abre no tema padrão e troca um instante depois — um
 * clarão escuro toda vez que o Hub carrega no tema claro. Ele roda no <head>,
 * antes de qualquer coisa aparecer, e é curto de propósito: um erro aqui
 * derrubaria a página inteira, então tudo fica dentro de um try.
 */
export const scriptDoTema = `try{var t=localStorage.getItem("${CHAVE_TEMA}");if(t==="noite"||t==="oceano"||t==="claro"||t==="areia")document.documentElement.dataset.tema=t}catch(e){}`;

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
