/**
 * A foto de perfil.
 *
 * REUSA O COFRE QUE JÁ EXISTE
 *
 * Vai para o bucket `university-documents`, o mesmo dos anexos do Relatório,
 * sob a pasta `perfil/`. A política dele já é por pasta de usuário — cada um
 * só enxerga a própria —, então não há bucket, regra nem chave nova para
 * configurar.
 *
 * A IMAGEM É REFEITA AQUI, ANTES DE SUBIR
 *
 * A foto passa por um canvas e sai como um JPEG quadrado de 256 px. Três
 * coisas acontecem de uma vez:
 *
 *   - fica leve: uma foto de celular de 4 MB vira uns 20 kB;
 *   - o formato é sempre o mesmo, então exibir não depende do que foi enviado;
 *   - os metadados somem. Foto de celular guarda a localização GPS de onde foi
 *     tirada, e redesenhar os pixels num canvas não carrega nada disso junto.
 *
 * E se o arquivo não for imagem de verdade, o navegador não consegue
 * decodificá-lo e a troca para ali — checagem mais forte do que olhar a
 * extensão ou os primeiros bytes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "university-documents";
const LADO = 256;
const CHAVE_LOCAL = "artx-avatar";

function caminho(uid: string): string {
  return `${uid}/perfil/avatar.jpg`;
}

async function dono(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Recorta o centro da imagem num quadrado e reduz.
 *
 * O recorte é do centro porque é onde o rosto costuma estar numa foto de
 * perfil; cortar sempre do topo decapitaria a pessoa numa foto deitada.
 */
export async function recortarQuadrado(arquivo: File, lado = LADO): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(arquivo);
  } catch {
    throw new Error("Esse arquivo não é uma imagem que dê para abrir.");
  }

  const menor = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - menor) / 2;
  const sy = (bitmap.height - menor) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("O navegador não deixou preparar a imagem.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, menor, menor, 0, 0, lado, lado);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolver) => canvas.toBlob(resolver, "image/jpeg", 0.86));
  if (!blob) throw new Error("Não consegui preparar a imagem.");
  return blob;
}

/** Guarda a foto neste navegador, para ela aparecer na hora em vez de piscar. */
function guardarLocal(dataUrl: string | null) {
  try {
    if (dataUrl) localStorage.setItem(CHAVE_LOCAL, dataUrl);
    else localStorage.removeItem(CHAVE_LOCAL);
  } catch {
    // Sem espaço ou navegação privada: a foto vem do cofre, só um instante depois.
  }
}

export function avatarLocal(): string | null {
  try {
    return localStorage.getItem(CHAVE_LOCAL);
  } catch {
    return null;
  }
}

function paraDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolver, rejeitar) => {
    const leitor = new FileReader();
    leitor.onload = () => resolver(String(leitor.result));
    leitor.onerror = () => rejeitar(new Error("Não consegui ler a imagem."));
    leitor.readAsDataURL(blob);
  });
}

export async function enviarAvatar(supabase: SupabaseClient | null, arquivo: File): Promise<string> {
  if (!supabase) throw new Error("Conta não configurada neste ambiente.");
  const uid = await dono(supabase);
  if (!uid) throw new Error("Entre na conta para trocar a foto.");

  const blob = await recortarQuadrado(arquivo);
  const { error } = await supabase.storage.from(BUCKET).upload(caminho(uid), blob, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error("Não consegui guardar a foto. Tente de novo.");

  const dataUrl = await paraDataUrl(blob);
  guardarLocal(dataUrl);
  return dataUrl;
}

/** A foto guardada na conta, ou `null` se ainda não houver. */
export async function baixarAvatar(supabase: SupabaseClient | null): Promise<string | null> {
  if (!supabase) return null;
  const uid = await dono(supabase);
  if (!uid) return null;
  const { data, error } = await supabase.storage.from(BUCKET).download(caminho(uid));
  if (error || !data) return null;
  const dataUrl = await paraDataUrl(data);
  guardarLocal(dataUrl);
  return dataUrl;
}

export async function removerAvatar(supabase: SupabaseClient | null): Promise<void> {
  if (!supabase) throw new Error("Conta não configurada neste ambiente.");
  const uid = await dono(supabase);
  if (!uid) throw new Error("Entre na conta para tirar a foto.");
  await supabase.storage.from(BUCKET).remove([caminho(uid)]);
  guardarLocal(null);
}
