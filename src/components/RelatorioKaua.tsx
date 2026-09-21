"use client";

/**
 * Relatório do Kauã.
 *
 * Uma aba só sua. Não sincroniza, não pede login, não conversa com servidor
 * nenhum — foi o pedido, e tem uma consequência que a tela diz em voz alta:
 * limpar os dados do navegador apaga isto junto. Por isso existe o exportar.
 *
 * As anotações vivem sete dias e somem. Como apagar o que alguém escreveu é
 * coisa séria mesmo quando foi a pessoa que pediu, três coisas aparecem sempre:
 * quantos dias faltam em cada uma, um aviso do que saiu desde a última visita,
 * e um botão para devolver a semana quando a anotação ainda importa.
 */

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Check, Circle, Download, Paperclip, Plus, RotateCcw, Trash2, Upload, X } from "lucide-react";

import {
  CHAVE,
  DIAS_DE_VIDA,
  alternarDocumento,
  criarAnotacao,
  criarDocumento,
  diasRestantes,
  expurgar,
  ler,
  porUrgencia,
  progressoDocumentos,
  definirValidade,
  diasParaVencer,
  estadoValidade,
  precisamAtencao,
  relatorioVazio,
  removerDocumento,
  renovar,
  semear,
  unir,
  type Anotacao,
  type Relatorio,
} from "@/lib/relatorio";
import { grupos } from "@/lib/espanha";
import {
  baixar,
  espacoUsado,
  formatarTamanho,
  listarFichas,
  porDocumento,
  removerAnexo,
  removerDoDocumento,
  salvarAnexo,
  type FichaAnexo,
} from "@/lib/anexos";

function guardar(relatorio: Relatorio) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(relatorio));
  } catch {
    // Navegação privada ou armazenamento cheio. A tela continua funcionando
    // nesta sessão; o que não pode é quebrar por causa da gravação.
  }
}

/** Prazo em palavras. "0 dias" não é como ninguém fala. */
function prazoEmPalavras(dias: number): string {
  if (dias <= 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  return `${dias} dias`;
}

export function RelatorioKaua() {
  const [relatorio, setRelatorio] = useState<Relatorio>(relatorioVazio);
  const [pronto, setPronto] = useState(false);
  const [saiu, setSaiu] = useState<Anotacao[]>([]);
  const [aviso, setAviso] = useState("");

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [novoDoc, setNovoDoc] = useState("");
  const [fichas, setFichas] = useState<FichaAnexo[]>([]);

  // Lê e já limpa o que passou do prazo, guardando o que saiu para contar.
  useEffect(() => {
    const lido = ler(typeof window === "undefined" ? null : localStorage.getItem(CHAVE));
    const { relatorio: limpo, removidas } = expurgar(lido);
    // A lista da Espanha entra aqui na primeira abertura. Semear não toca no
    // que já existe nem traz de volta o que foi apagado.
    const { relatorio: completo, adicionados } = semear(limpo);
    setRelatorio(completo);
    setSaiu(removidas);
    if (removidas.length > 0 || adicionados > 0) guardar(completo);
    setPronto(true);
    // Os arquivos vivem em outro cofre (IndexedDB) e são lidos à parte.
    listarFichas().then(setFichas).catch(() => setFichas([]));
  }, []);

  function aplicar(proximo: Relatorio) {
    setRelatorio(proximo);
    guardar(proximo);
  }

  const anotacoes = useMemo(() => porUrgencia(relatorio.anotacoes), [relatorio.anotacoes]);
  const progresso = progressoDocumentos(relatorio.documentos);
  const anexosDe = useMemo(() => porDocumento(fichas), [fichas]);
  const atencao = useMemo(() => precisamAtencao(relatorio.documentos), [relatorio.documentos]);

  function adicionarAnotacao(evento: React.FormEvent) {
    evento.preventDefault();
    const nova = criarAnotacao(titulo, descricao);
    if (!nova) return;
    aplicar({ ...relatorio, anotacoes: [...relatorio.anotacoes, nova] });
    setTitulo("");
    setDescricao("");
  }

  function adicionarDocumento(evento: React.FormEvent) {
    evento.preventDefault();
    const doc = criarDocumento(novoDoc);
    if (!doc) return;
    aplicar({ ...relatorio, documentos: [...relatorio.documentos, doc] });
    setNovoDoc("");
  }

  async function anexar(documentoId: string, arquivo: File) {
    try {
      await salvarAnexo(documentoId, arquivo);
      setFichas(await listarFichas());
      setAviso("");
    } catch (erro) {
      setAviso(erro instanceof Error ? erro.message : "Não consegui guardar esse arquivo.");
    }
  }

  async function tirarAnexo(id: string) {
    await removerAnexo(id);
    setFichas(await listarFichas());
  }

  /**
   * Apagar o documento leva os arquivos dele junto.
   *
   * Sem isto, os bytes ficariam no navegador para sempre, sem nenhuma tela por
   * onde alcançá-los — ocupando espaço que ninguém consegue liberar.
   */
  async function apagarDocumento(id: string) {
    aplicar(removerDocumento(relatorio, id));
    await removerDoDocumento(id);
    setFichas(await listarFichas());
  }

  function exportar() {
    const blob = new Blob([JSON.stringify(relatorio, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-kaua-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importar(arquivo: File) {
    try {
      const { relatorio: unido, novas } = unir(relatorio, ler(await arquivo.text()));
      aplicar(unido);
      setAviso(novas > 0 ? `${novas} item(ns) somado(s). Nada foi sobrescrito.` : "Nada de novo nesse arquivo.");
    } catch {
      setAviso("Não consegui ler esse arquivo.");
    }
  }

  if (!pronto) return <div className="relatorio-page page-enter" />;

  return (
    <div className="relatorio-page page-enter">
      <header className="relatorio-topo">
        <div>
          <p className="eyebrow">SÓ SEU · NÃO SAI DESTE APARELHO</p>
          <h1>Relatório do Kauã</h1>
        </div>
        <div className="relatorio-acoes">
          <button onClick={exportar}>
            <Download size={15} /> Exportar
          </button>
          <label className="relatorio-importar">
            <Upload size={15} /> Importar
            <input
              type="file"
              accept="application/json"
              hidden
              onChange={(evento) => {
                const escolhido = evento.target.files?.[0];
                if (escolhido) void importar(escolhido);
                evento.target.value = "";
              }}
            />
          </label>
        </div>
      </header>

      {saiu.length > 0 && (
        <div className="relatorio-expirou" role="status">
          <AlertTriangle size={16} />
          <div>
            <strong>
              {saiu.length} anotação{saiu.length > 1 ? "ões" : ""} passou dos {DIAS_DE_VIDA} dias e saiu.
            </strong>
            <small>{saiu.map((item) => item.titulo).join(" · ")}</small>
          </div>
          <button onClick={() => setSaiu([])} aria-label="Dispensar aviso">
            <X size={15} />
          </button>
        </div>
      )}

      <div className="relatorio-grade">
        {/* ── Anotações ──────────────────────────────────────────────── */}
        <section className="relatorio-bloco">
          <div className="relatorio-cabeca">
            <h2>Anotações</h2>
            <span className="relatorio-regra">somem em {DIAS_DE_VIDA} dias</span>
          </div>

          <form className="relatorio-form" onSubmit={adicionarAnotacao}>
            <input
              value={titulo}
              onChange={(evento) => setTitulo(evento.target.value)}
              maxLength={200}
              placeholder="Nome da anotação"
              aria-label="Nome da anotação"
            />
            <textarea
              value={descricao}
              onChange={(evento) => setDescricao(evento.target.value)}
              maxLength={5000}
              placeholder="Descrição (opcional)"
              aria-label="Descrição"
            />
            <button type="submit" disabled={!titulo.trim()}>
              <Plus size={15} /> Salvar
            </button>
          </form>

          {anotacoes.length === 0 ? (
            <p className="relatorio-vazio">Nada anotado ainda. O que você escrever aqui fica por {DIAS_DE_VIDA} dias.</p>
          ) : (
            <ul className="relatorio-lista">
              {anotacoes.map((item) => {
                const dias = diasRestantes(item);
                return (
                  <li key={item.id} className={dias <= 1 ? "acabando" : ""}>
                    <div className="relatorio-item-topo">
                      <strong>{item.titulo}</strong>
                      <span className="relatorio-prazo">{prazoEmPalavras(dias)}</span>
                    </div>
                    {item.descricao && <p>{item.descricao}</p>}
                    <div className="relatorio-item-pe">
                      {item.renovacoes > 0 && (
                        <small>
                          renovada {item.renovacoes}×
                        </small>
                      )}
                      <button
                        onClick={() =>
                          aplicar({
                            ...relatorio,
                            anotacoes: relatorio.anotacoes.map((a) => (a.id === item.id ? renovar(a) : a)),
                          })
                        }
                      >
                        <RotateCcw size={13} /> mais {DIAS_DE_VIDA} dias
                      </button>
                      <button
                        className="relatorio-apagar"
                        onClick={() =>
                          aplicar({ ...relatorio, anotacoes: relatorio.anotacoes.filter((a) => a.id !== item.id) })
                        }
                        aria-label={`Apagar ${item.titulo}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── Documentos para a Espanha ──────────────────────────────── */}
        <section className="relatorio-bloco">
          <div className="relatorio-cabeca">
            <h2>Documentos · Espanha</h2>
            <span className="relatorio-regra">
              {progresso.feitos} de {progresso.total}
            </span>
          </div>

          {atencao.length > 0 && (
            <div className="relatorio-atencao" role="status">
              <CalendarClock size={15} />
              <div>
                <strong>
                  {atencao.length} documento{atencao.length > 1 ? "s" : ""} pedindo atenção
                </strong>
                <small>
                  {atencao
                    .map((doc) => {
                      const dias = diasParaVencer(doc);
                      if (dias === null) return doc.nome;
                      return `${doc.nome} — ${dias < 0 ? `venceu há ${Math.abs(dias)} dia${Math.abs(dias) > 1 ? "s" : ""}` : dias === 0 ? "vence hoje" : `${dias} dia${dias > 1 ? "s" : ""}`}`;
                    })
                    .join(" · ")}
                </small>
              </div>
            </div>
          )}

          <p className="relatorio-origem">
            Lista trazida por você, não conferida por mim. Os requisitos mudam por consulado, por curso e por
            categoria de vaga — confirme a lista vigente no Consulado-Geral da Espanha antes de pagar tradução,
            apostila ou taxa.
          </p>

          <form className="relatorio-form linha" onSubmit={adicionarDocumento}>
            <input
              value={novoDoc}
              onChange={(evento) => setNovoDoc(evento.target.value)}
              maxLength={200}
              placeholder="Acrescentar um documento"
              aria-label="Nome do documento"
            />
            <button type="submit" disabled={!novoDoc.trim()}>
              <Plus size={15} /> Adicionar
            </button>
          </form>

          {grupos.map((grupo) => {
            const doGrupo = relatorio.documentos.filter((item) => item.grupo === grupo.id);
            if (doGrupo.length === 0) return null;
            const p = progressoDocumentos(doGrupo);

            return (
              <section key={grupo.id} className="relatorio-grupo">
                <header>
                  <div>
                    <h3>{grupo.titulo}</h3>
                    <p>{grupo.resumo}</p>
                  </div>
                  <span className={`relatorio-quando ${grupo.agora ? "ja" : "depois"}`}>
                    {grupo.agora ? "dá para fazer agora" : "depende de uma oportunidade"}
                  </span>
                </header>

                <div className="relatorio-barra" role="img" aria-label={`${p.feitos} de ${p.total}`}>
                  <span style={{ width: `${p.fracao * 100}%` }} />
                </div>

                {grupo.depende.length > 0 && (
                  <ul className="relatorio-depende">
                    {grupo.depende.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}

                <ul className="relatorio-docs">
                  {doGrupo.map((doc) => {
                    const anexos = anexosDe.get(doc.id) ?? [];
                    return (
                      <li key={doc.id} className={doc.feito ? "feito" : ""}>
                        <div className="relatorio-doc-linha">
                          <button
                            className="relatorio-marcar"
                            onClick={() =>
                              aplicar({
                                ...relatorio,
                                documentos: relatorio.documentos.map((d) =>
                                  d.id === doc.id ? alternarDocumento(d) : d,
                                ),
                              })
                            }
                            aria-pressed={doc.feito}
                          >
                            {doc.feito ? <Check size={16} /> : <Circle size={16} />}
                            <span>{doc.nome}</span>
                          </button>

                          {anexos.length > 0 && <span className="relatorio-conta-anexo">{anexos.length}</span>}

                          <label
                            className={`relatorio-validade ${estadoValidade(doc)}`}
                            title={doc.validade ? `Vale até ${doc.validade}` : "Definir até quando este documento vale"}
                          >
                            <CalendarClock size={14} />
                            <span className="sr-only">Validade de {doc.nome}</span>
                            <input
                              type="date"
                              value={doc.validade ?? ""}
                              onChange={(evento) =>
                                aplicar({
                                  ...relatorio,
                                  documentos: relatorio.documentos.map((d) =>
                                    d.id === doc.id ? definirValidade(d, evento.target.value) : d,
                                  ),
                                })
                              }
                            />
                          </label>

                          <label className="relatorio-anexar" title={`Anexar arquivo a "${doc.nome}"`}>
                            <Paperclip size={14} />
                            <span className="sr-only">Anexar arquivo a {doc.nome}</span>
                            <input
                              type="file"
                              hidden
                              onChange={(evento) => {
                                const escolhido = evento.target.files?.[0];
                                if (escolhido) void anexar(doc.id, escolhido);
                                evento.target.value = "";
                              }}
                            />
                          </label>

                          <button
                            className="relatorio-apagar"
                            onClick={() => void apagarDocumento(doc.id)}
                            aria-label={`Remover ${doc.nome}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        {anexos.length > 0 && (
                          <ul className="relatorio-anexos">
                            {anexos.map((ficha) => (
                              <li key={ficha.id}>
                                <button
                                  className="relatorio-baixar"
                                  onClick={() =>
                                    void baixar(ficha.id).then((achou) => {
                                      if (!achou) setAviso("Esse arquivo não está mais guardado aqui.");
                                    })
                                  }
                                >
                                  <Download size={12} />
                                  <span>{ficha.nome}</span>
                                  <small>{formatarTamanho(ficha.tamanho)}</small>
                                </button>
                                <button
                                  className="relatorio-apagar"
                                  onClick={() => void tirarAnexo(ficha.id)}
                                  aria-label={`Remover o arquivo ${ficha.nome}`}
                                >
                                  <X size={12} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </section>
      </div>

      <footer className="relatorio-rodape">
        <p>
          Isto vive só neste navegador — sem conta e sem servidor, como você pediu. Limpar os dados do site apaga
          tudo, inclusive os arquivos anexados.
        </p>
        {fichas.length > 0 && (
          <p className="relatorio-espaco">
            <Paperclip size={12} /> {fichas.length} arquivo{fichas.length > 1 ? "s" : ""} guardado
            {fichas.length > 1 ? "s" : ""} · {formatarTamanho(espacoUsado(fichas))}.{" "}
            <strong>O exportar leva a checklist e as anotações, não os arquivos</strong> — para esses, use o botão de
            baixar em cada um e guarde a cópia onde você quiser.
          </p>
        )}
      </footer>

      {aviso && (
        <p className="relatorio-aviso" role="status">
          {aviso}
        </p>
      )}
    </div>
  );
}
