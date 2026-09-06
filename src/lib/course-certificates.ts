// Reuses the private document bucket and its existing user-folder RLS policies.
// Course files have a separate prefix; University Path records are never changed.
export const certificateBucket = "university-documents";
export const certificateMaxBytes = 10 * 1024 * 1024;
const localOrigin = "https://artx-local.invalid";
const allowedTypes = new Set(["application/pdf", "image/png", "image/jpeg"]);

export async function validateCertificate(file: File) {
  if (!file.size || file.size > certificateMaxBytes) throw new Error("Escolha um arquivo de até 10 MB.");
  if (!allowedTypes.has(file.type)) throw new Error("Use um certificado em PDF, JPG ou PNG.");
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const pdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte);
  const jpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!(file.type === "application/pdf" ? pdf : file.type === "image/png" ? png : jpg)) {
    throw new Error("O conteúdo do arquivo não corresponde ao formato informado.");
  }
}

export function certificatePath(owner: string, courseId: string, name: string, version = crypto.randomUUID()) {
  if (![owner, courseId, version].every((part) => /^[a-zA-Z0-9-]+$/.test(part))) throw new Error("Identificação inválida.");
  const safeName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || "certificado.pdf";
  return `${owner}/course-certificates/${courseId}/${version}/${safeName}`;
}

export function certificateReference(origin: string | null, path: string) {
  return `${origin ? new URL(origin).origin : localOrigin}/storage/v1/object/authenticated/${certificateBucket}/${path}`;
}

export function parseCertificateReference(reference: string, origin: string | null, owner: string, courseId: string) {
  const url = new URL(reference);
  const expectedOrigin = origin ? new URL(origin).origin : localOrigin;
  const prefix = `/storage/v1/object/authenticated/${certificateBucket}/${owner}/course-certificates/${courseId}/`;
  if (url.origin !== expectedOrigin || url.search || url.hash || !url.pathname.startsWith(prefix)) throw new Error("Certificado inválido para este curso.");
  const suffix = url.pathname.slice(prefix.length);
  if (!/^[a-zA-Z0-9-]+\/[a-zA-Z0-9._-]+$/.test(suffix)) throw new Error("Caminho de certificado inválido.");
  return { path: `${owner}/course-certificates/${courseId}/${suffix}`, name: suffix.split("/")[1] };
}

export function isStoredCertificate(reference: string) {
  try {
    const url = new URL(reference);
    return url.pathname.startsWith(`/storage/v1/object/authenticated/${certificateBucket}/`);
  } catch { return false; }
}

// Blob storage avoids putting large certificates or base64 into localStorage.
export async function localCertificate(action: "put" | "get" | "delete", key: string, file?: Blob): Promise<Blob | undefined> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("artx-course-certificates", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Não foi possível abrir o armazenamento local."));
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("files", action === "get" ? "readonly" : "readwrite");
      const store = tx.objectStore("files");
      const request = action === "get" ? store.get(key) : action === "put" ? store.put(file, key) : store.delete(key);
      tx.oncomplete = () => resolve(action === "get" ? request.result as Blob | undefined : undefined);
      tx.onerror = tx.onabort = () => reject(new Error("Não foi possível salvar ou ler o certificado neste dispositivo."));
    });
  } finally { db.close(); }
}

export function downloadCertificate(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
