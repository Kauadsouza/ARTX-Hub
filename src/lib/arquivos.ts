/**
 * Que arquivo pode entrar.
 *
 * A checagem é pelos primeiros bytes, não pela extensão nem pelo tipo que o
 * navegador declara. Os dois são texto que quem envia escolhe: renomear um
 * executável para `certificado.pdf` não custa nada, e o `Content-Type` vem
 * do mesmo lugar. Os bytes iniciais, não — eles são o formato de verdade.
 *
 * A lista é fechada: PDF e imagem. É o que um certificado é.
 */

export const LIMITE_BYTES = 1_400_000;

export type Formato = { tipo: string; extensao: string };

type Assinatura = { bytes: number[]; deslocamento?: number; extra?: (b: Uint8Array) => boolean } & Formato;

const assinaturas: Assinatura[] = [
  { bytes: [0x25, 0x50, 0x44, 0x46], tipo: "application/pdf", extensao: "pdf" },
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], tipo: "image/png", extensao: "png" },
  { bytes: [0xff, 0xd8, 0xff], tipo: "image/jpeg", extensao: "jpg" },
  {
    // WEBP é "RIFF" + 4 bytes de tamanho + "WEBP". O miolo varia, então o
    // começo sozinho não basta.
    bytes: [0x52, 0x49, 0x46, 0x46],
    tipo: "image/webp",
    extensao: "webp",
    extra: (b) => b.length > 11 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

/**
 * O formato real do arquivo, ou `null` se não for um dos aceitos.
 *
 * `null` vira recusa com mensagem. Aceitar "porque o nome termina em .pdf"
 * seria guardar qualquer coisa e devolver depois como se fosse um documento.
 */
export function formatoDe(bytes: Uint8Array): Formato | null {
  for (const assinatura of assinaturas) {
    const inicio = assinatura.deslocamento ?? 0;
    if (bytes.length < inicio + assinatura.bytes.length) continue;
    const bate = assinatura.bytes.every((byte, i) => bytes[inicio + i] === byte);
    if (!bate) continue;
    if (assinatura.extra && !assinatura.extra(bytes)) continue;
    return { tipo: assinatura.tipo, extensao: assinatura.extensao };
  }
  return null;
}

/** Nome de arquivo seguro: sem caminho, sem caractere de controle, com tamanho. */
export function nomeSeguro(nome: string, extensao: string): string {
  const base = nome
    .split(/[/\\]/)
    .pop()!
    .replace(/\.[^.]*$/, "")
    .replace(/[^\p{L}\p{N} ._-]/gu, "")
    .trim()
    .slice(0, 80);

  /* Um nome só de pontos ou traços sobrevive a tudo acima e vira algo como
     "....pdf". Exigir ao menos uma letra ou número é o que separa um nome de
     um enfeite. */
  const temConteudo = /[\p{L}\p{N}]/u.test(base);
  return `${temConteudo ? base : "certificado"}.${extensao}`;
}
