/**
 * Os anexos no cofre da conta.
 *
 * O IndexedDB continua sendo onde o arquivo é lido: é instantâneo e funciona
 * sem rede. O cofre é a cópia que sobrevive a limpar o navegador, trocar de
 * computador ou o disco morrer — e é aí que moram o passaporte e as certidões,
 * então esta é a parte do sistema que mais precisa durar.
 *
 * REUSA O COFRE QUE JÁ EXISTE
 *
 * O bucket `university-documents` já está no ar, com política por pasta de
 * usuário: cada um só enxerga a própria. Os arquivos do relatório entram sob um
 * prefixo próprio, sem tocar no que o University Path guarda lá.
 *
 * O LIMITE VEM DO COFRE, NÃO DO GOSTO
 *
 * O bucket aceita PDF, JPG e PNG até 15 MB. Aceitar mais aqui só criaria
 * arquivos que nunca poderiam ser protegidos — a pessoa anexaria confiando, e a
 * cópia falharia calada. Melhor recusar na hora e dizer por quê.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { lerAnexo, salvarAnexoBruto, type Anexo, type FichaAnexo } from "./anexos.ts";

export const BUCKET = "university-documents";
export const PREFIXO = "relatorio";

/** Teto do bucket. Acima disto o upload seria recusado pelo servidor. */
export const TAMANHO_MAXIMO = 15 * 1024 * 1024;

export const TIPOS_ACEITOS = ["application/pdf", "image/jpeg", "image/png"] as const;

/**
 * Confere o tipo pelo conteúdo, não pela extensão.
 *
 * Renomear um .exe para .pdf engana a extensão e o `file.type`, que vem do
 * sistema operacional. Os primeiros bytes não mentem — e é essa a checagem que
 * o resto do Hub já faz nos certificados.
 */
export async function validar(arquivo: File): Promise<void> {
  if (!arquivo.size) throw new Error("O arquivo está vazio.");
  if (arquivo.size > TAMANHO_MAXIMO) {
    throw new Error(`Arquivo de ${(arquivo.size / 1048576).toFixed(1)} MB. O limite do cofre é 15 MB.`);
  }
  if (!TIPOS_ACEITOS.includes(arquivo.type as (typeof TIPOS_ACEITOS)[number])) {
    throw new Error("Use PDF, JPG ou PNG — são os formatos que o cofre guarda.");
  }
  const bytes = new Uint8Array(await arquivo.slice(0, 8).arrayBuffer());
  const pdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b);
  const jpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const bate = arquivo.type === "application/pdf" ? pdf : arquivo.type === "image/png" ? png : jpg;
  if (!bate) throw new Error("O conteúdo do arquivo não corresponde ao formato informado.");
}

/**
 * Caminho no cofre.
 *
 * A pasta do usuário vem primeiro porque é sobre ela que a política do banco
 * decide quem pode ler. O id do anexo entra no nome para dois arquivos com o
 * mesmo título não se atropelarem.
 */
export function caminho(dono: string, anexoId: string, nome: string): string {
  // Vira um segmento só: sem barra, sem sequência de pontos e sem começar por
  // ponto. Um nome como "../../etc/passwd" não tem como subir de pasta depois
  // disto, e não vira arquivo oculto no caminho.
  const limpo = nome
    .replace(/[^\w.\-]+/g, "_")
    .replace(/\.{2,}/g, "_")
    .replace(/^[.\-]+/, "")
    .slice(-80) || "arquivo";
  return `${dono}/${PREFIXO}/${anexoId}-${limpo}`;
}

async function dono(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Sobe um anexo já guardado aqui. Devolve o caminho, ou o motivo de não ter ido. */
export async function subir(
  supabase: SupabaseClient | null,
  ficha: FichaAnexo,
): Promise<{ ok: true; caminho: string } | { ok: false; motivo: string }> {
  if (!supabase) return { ok: false, motivo: "Conta não configurada neste ambiente." };
  const uid = await dono(supabase);
  if (!uid) return { ok: false, motivo: "Entre na conta para guardar a cópia." };

  const anexo = await lerAnexo(ficha.id);
  if (!anexo) return { ok: false, motivo: "O arquivo não está mais neste aparelho." };

  const destino = caminho(uid, anexo.id, anexo.nome);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(destino, anexo.arquivo, { contentType: anexo.tipo, upsert: true });

  if (error) return { ok: false, motivo: error.message || "O envio falhou." };
  return { ok: true, caminho: destino };
}

/** O que existe no cofre, para saber o que falta aqui. */
export async function listarNoCofre(
  supabase: SupabaseClient | null,
): Promise<{ ok: true; nomes: string[] } | { ok: false; motivo: string }> {
  if (!supabase) return { ok: false, motivo: "Conta não configurada neste ambiente." };
  const uid = await dono(supabase);
  if (!uid) return { ok: false, motivo: "Entre na conta para ver a cópia." };

  const { data, error } = await supabase.storage.from(BUCKET).list(`${uid}/${PREFIXO}`, { limit: 200 });
  if (error) return { ok: false, motivo: error.message || "Não consegui listar o cofre." };
  return { ok: true, nomes: (data ?? []).map((item) => item.name) };
}

/**
 * Traz de volta o que está no cofre e não está aqui.
 *
 * É este caminho que faz o computador novo — ou o navegador limpo — voltar a
 * ter os documentos. Sem ele, o cofre seria um depósito sem porta de saída.
 */
export async function restaurar(
  supabase: SupabaseClient | null,
  jaAqui: FichaAnexo[],
): Promise<{ baixados: number; motivo?: string }> {
  const lista = await listarNoCofre(supabase);
  if (!lista.ok) return { baixados: 0, motivo: lista.motivo };
  const uid = await dono(supabase!);
  if (!uid) return { baixados: 0, motivo: "Entre na conta." };

  const idsAqui = new Set(jaAqui.map((item) => item.id));
  let baixados = 0;

  for (const nome of lista.nomes) {
    const id = nome.split("-").slice(0, 3).join("-");
    if (idsAqui.has(id)) continue;

    const { data, error } = await supabase!.storage.from(BUCKET).download(`${uid}/${PREFIXO}/${nome}`);
    if (error || !data) continue;

    const anexo: Anexo = {
      id,
      // O documento a que ele pertencia não vem no nome do arquivo; fica solto
      // até a pessoa reanexar. É melhor que perder o arquivo.
      documentoId: "",
      nome: nome.slice(id.length + 1),
      tipo: data.type || "application/octet-stream",
      tamanho: data.size,
      adicionadoEm: new Date().toISOString(),
      arquivo: data,
    };
    await salvarAnexoBruto(anexo);
    baixados++;
  }

  return { baixados };
}

/** Tira a cópia do cofre quando o anexo é apagado aqui. */
export async function remover(supabase: SupabaseClient | null, ficha: FichaAnexo): Promise<void> {
  if (!supabase) return;
  const uid = await dono(supabase);
  if (!uid) return;
  await supabase.storage.from(BUCKET).remove([caminho(uid, ficha.id, ficha.nome)]);
}
