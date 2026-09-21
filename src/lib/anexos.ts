/**
 * Anexos dos documentos.
 *
 * Os arquivos vão para o IndexedDB, não para o localStorage. Não é preferência:
 * o localStorage guarda só texto, o que obrigaria a converter cada PDF em
 * base64 — um terço maior — dentro de um cofre de cinco megabytes. Uma foto de
 * passaporte sozinha já estouraria. O IndexedDB guarda o arquivo como ele é.
 *
 * A ficha do anexo mora junto do arquivo, no mesmo registro. Se o nome e o
 * tamanho ficassem no relatório e os bytes aqui, os dois poderiam divergir — e
 * a tela mostraria "passaporte.pdf" para um arquivo que não existe mais.
 *
 * Continua valendo o que vale para o resto desta aba: isto é este navegador,
 * neste computador. Não há servidor. Por isso cada anexo tem botão de baixar, e
 * a tela diz que a exportação em JSON não leva os arquivos junto.
 */

const BANCO = "artx-relatorio-anexos";
const LOJA = "anexos";
const VERSAO = 1;

/** Teto por arquivo. Acima disto é quase certo que é vídeo, não documento. */
export const TAMANHO_MAXIMO = 25 * 1024 * 1024;

export type Anexo = {
  id: string;
  /** A qual documento da checklist este arquivo pertence. */
  documentoId: string;
  nome: string;
  tipo: string;
  tamanho: number;
  adicionadoEm: string;
  arquivo: Blob;
};

/** A ficha sem os bytes, para listar sem carregar tudo na memória. */
export type FichaAnexo = Omit<Anexo, "arquivo">;

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Este navegador não guarda arquivos."));
      return;
    }
    const pedido = indexedDB.open(BANCO, VERSAO);
    pedido.onupgradeneeded = () => {
      const banco = pedido.result;
      if (!banco.objectStoreNames.contains(LOJA)) {
        const loja = banco.createObjectStore(LOJA, { keyPath: "id" });
        // Buscar por documento sem varrer a loja inteira.
        loja.createIndex("documentoId", "documentoId", { unique: false });
      }
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error ?? new Error("Não consegui abrir o armazenamento."));
  });
}

function comLoja<T>(modo: IDBTransactionMode, acao: (loja: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return abrir().then(
    (banco) =>
      new Promise<T>((resolve, reject) => {
        const transacao = banco.transaction(LOJA, modo);
        const pedido = acao(transacao.objectStore(LOJA));
        pedido.onsuccess = () => resolve(pedido.result);
        pedido.onerror = () => reject(pedido.error ?? new Error("A operação falhou."));
        transacao.oncomplete = () => banco.close();
      }),
  );
}

function novoId(): string {
  return `anexo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Guarda um arquivo.
 *
 * Recusa o que passa do teto em vez de tentar e falhar no meio da gravação: o
 * erro do IndexedDB por cota estourada é obscuro, e a pessoa merece saber o
 * motivo real.
 */
export async function salvarAnexo(documentoId: string, arquivo: File): Promise<FichaAnexo> {
  if (arquivo.size > TAMANHO_MAXIMO) {
    throw new Error(`Arquivo de ${formatarTamanho(arquivo.size)}. O limite aqui é ${formatarTamanho(TAMANHO_MAXIMO)}.`);
  }
  const anexo: Anexo = {
    id: novoId(),
    documentoId,
    nome: arquivo.name,
    tipo: arquivo.type || "application/octet-stream",
    tamanho: arquivo.size,
    adicionadoEm: new Date().toISOString(),
    arquivo,
  };
  await comLoja("readwrite", (loja) => loja.put(anexo));
  const { arquivo: _bytes, ...ficha } = anexo;
  void _bytes;
  return ficha;
}

/** As fichas de todos os anexos, sem carregar os bytes. */
export async function listarFichas(): Promise<FichaAnexo[]> {
  const todos = await comLoja<Anexo[]>("readonly", (loja) => loja.getAll());
  return todos
    .map(({ arquivo: _bytes, ...ficha }) => {
      void _bytes;
      return ficha;
    })
    .sort((a, b) => a.adicionadoEm.localeCompare(b.adicionadoEm));
}

export async function lerAnexo(id: string): Promise<Anexo | undefined> {
  return comLoja<Anexo | undefined>("readonly", (loja) => loja.get(id));
}

export async function removerAnexo(id: string): Promise<void> {
  await comLoja("readwrite", (loja) => loja.delete(id));
}

/** Tira os anexos de um documento que deixou de existir. */
export async function removerDoDocumento(documentoId: string): Promise<number> {
  const fichas = await listarFichas();
  const alvos = fichas.filter((item) => item.documentoId === documentoId);
  for (const alvo of alvos) await removerAnexo(alvo.id);
  return alvos.length;
}

/** Quanto os anexos ocupam, somando as fichas. */
export function espacoUsado(fichas: FichaAnexo[]): number {
  return fichas.reduce((total, item) => total + item.tamanho, 0);
}

/** Agrupa por documento, para a tela achar os anexos de cada linha. */
export function porDocumento(fichas: FichaAnexo[]): Map<string, FichaAnexo[]> {
  const mapa = new Map<string, FichaAnexo[]>();
  for (const ficha of fichas) {
    const atual = mapa.get(ficha.documentoId);
    if (atual) atual.push(ficha);
    else mapa.set(ficha.documentoId, [ficha]);
  }
  return mapa;
}

/** Entrega o arquivo ao navegador para download. */
export async function baixar(id: string): Promise<boolean> {
  const anexo = await lerAnexo(id);
  if (!anexo) return false;
  const url = URL.createObjectURL(anexo.arquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = anexo.nome;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}
