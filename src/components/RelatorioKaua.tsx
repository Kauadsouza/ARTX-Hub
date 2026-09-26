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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarClock, Check, Circle, Cloud, CloudOff, Download, Paperclip, Plus, RotateCcw, Trash2, Upload, X } from "lucide-react";

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
  definirNota,
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
import { createClient } from "@/lib/supabase/client";
import { descrever, empurrar, protegido, puxar, type EstadoEspelho } from "@/lib/relatorio-espelho";
import { remover as removerDoCofre, restaurar, subir, validar } from "@/lib/anexos-cofre";
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
import { useI18n } from "./I18n";
import type { Traduzir } from "@/lib/traducao";

function guardar(relatorio: Relatorio) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(relatorio));
  } catch {
    // Navegação privada ou armazenamento cheio. A tela continua funcionando
    // nesta sessão; o que não pode é quebrar por causa da gravação.
  }
}

/** Prazo em palavras. "0 dias" não é como ninguém fala. */
function prazoEmPalavras(dias: number, t: Traduzir): string {
  if (dias <= 0) return t("vence hoje");
  if (dias === 1) return t("vence amanhã");
  return t("{0} dias", [dias]);
}

/** O prazo de um documento: vencido, vence hoje, ou quantos dias faltam. */
function prazoDoDocumento(dias: number, t: Traduzir): string {
  if (dias < 0) return t(Math.abs(dias) > 1 ? "venceu há {0} dias" : "venceu há {0} dia", [Math.abs(dias)]);
  if (dias === 0) return t("vence hoje");
  return t(dias > 1 ? "{0} dias" : "{0} dia", [dias]);
}

export function RelatorioKaua() {
  const { t } = useI18n();
  const [relatorio, setRelatorio] = useState<Relatorio>(relatorioVazio);
  const [pronto, setPronto] = useState(false);
  const [saiu, setSaiu] = useState<Anotacao[]>([]);
  const [aviso, setAviso] = useState<{ texto: string; valores?: unknown[] } | null>(null);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [novoDoc, setNovoDoc] = useState("");
  const [fichas, setFichas] = useState<FichaAnexo[]>([]);

  // O espelho na conta. O relatório continua morando aqui; isto é a cópia.
  const supabase = useMemo(() => createClient(), []);
  const [espelho, setEspelho] = useState<EstadoEspelho>({ tipo: "iniciando" });
  const revisao = useRef(0);

  // Lê e já limpa o que passou do prazo, guardando o que saiu para contar.
  useEffect(() => {
    let ativo = true;
    const lido = ler(typeof window === "undefined" ? null : localStorage.getItem(CHAVE));

    // A tela abre com o que está aqui, sem esperar rede. A cópia da conta
    // chega depois e é juntada — ninguém fica olhando para uma tela vazia
    // porque a internet está lenta.
    const { relatorio: limpo, removidas } = expurgar(lido);
    const { relatorio: completo, adicionados } = semear(limpo);
    setRelatorio(completo);
    setSaiu(removidas);
    if (removidas.length > 0 || adicionados > 0) guardar(completo);
    setPronto(true);
    void listarFichas()
      .then(async (locais) => {
        if (!ativo) return;
        setFichas(locais);
        // O que está no cofre e não está aqui volta — é isto que faz um
        // navegador limpo recuperar os documentos.
        const { baixados } = await restaurar(supabase, locais);
        if (ativo && baixados > 0) {
          setFichas(await listarFichas());
          setAviso({ texto: "{0} arquivo(s) recuperado(s) da sua conta.", valores: [baixados] });
        }
      })
      .catch(() => setFichas([]));

    void puxar(supabase, completo).then(({ relatorio: unido, revisao: rev, estado }) => {
      if (!ativo) return;
      revisao.current = rev;
      setEspelho(estado);
      // Semear de novo porque a cópia da conta pode ser de uma versão antiga
      // da lista, sem os itens que entraram depois.
      const { relatorio: final } = semear(unido);
      setRelatorio(final);
      guardar(final);
    });

    return () => {
      ativo = false;
    };
  }, [supabase]);

  /**
   * Grava aqui primeiro, na conta depois.
   *
   * O local é imediato porque é o que a pessoa vê. A conta pode falhar, e
   * quando falha a tela diz — o relatório continua inteiro de qualquer jeito.
   */
  const aplicar = useCallback(
    (proximo: Relatorio) => {
      setRelatorio(proximo);
      guardar(proximo);
      void empurrar(supabase, proximo, revisao.current).then(({ revisao: rev, estado }) => {
        revisao.current = rev;
        setEspelho(estado);
      });
    },
    [supabase],
  );

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

  /**
   * Anexa aqui e manda a cópia para o cofre.
   *
   * A validação vem antes de tudo: formato e tamanho são conferidos contra o
   * que o cofre aceita, e o tipo é checado pelos primeiros bytes, não pela
   * extensão. Guardar um arquivo que a conta nunca aceitaria seria prometer
   * uma proteção que não viria.
   */
  async function anexar(documentoId: string, arquivo: File) {
    try {
      await validar(arquivo);
      const ficha = await salvarAnexo(documentoId, arquivo);
      setFichas(await listarFichas());
      setAviso(null);

      const copia = await subir(supabase, ficha);
      if (!copia.ok) setAviso({ texto: "Guardado aqui, mas a cópia na conta falhou: {0}", valores: [copia.motivo] });
    } catch (erro) {
      setAviso({ texto: erro instanceof Error ? erro.message : "Não consegui guardar esse arquivo." });
    }
  }

  async function tirarAnexo(id: string) {
    const ficha = fichas.find((item) => item.id === id);
    await removerAnexo(id);
    // A cópia do cofre sai junto: deixá-la lá seria guardar um documento que a
    // pessoa mandou apagar.
    if (ficha) await removerDoCofre(supabase, ficha);
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
    for (const ficha of fichas.filter((item) => item.documentoId === id)) {
      await removerDoCofre(supabase, ficha);
    }
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
      setAviso(novas > 0 ? { texto: "{0} item(ns) somado(s). Nada foi sobrescrito.", valores: [novas] } : { texto: "Nada de novo nesse arquivo." });
    } catch {
      setAviso({ texto: "Não consegui ler esse arquivo." });
    }
  }

  if (!pronto) return <div className="relatorio-page page-enter" />;

  return (
    <div className="relatorio-page page-enter">
      <header className="relatorio-topo">
        <div>
          <p className="eyebrow">{t("PRIVADO · SÓ VOCÊ VÊ")}</p>
          <h1>{t("Relatório do Kauã")}</h1>
        </div>
        <div className="relatorio-acoes">
          <span className={`relatorio-espelho ${protegido(espelho) ? "ok" : "alerta"}`} role="status">
            {protegido(espelho) ? <Cloud size={14} /> : <CloudOff size={14} />}
            {descrever(espelho, t)}
          </span>
          <button onClick={exportar}>
            <Download size={15} /> {t("Exportar")}
          </button>
          <label className="relatorio-importar">
            <Upload size={15} /> {t("Importar")}
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
              {t(saiu.length > 1 ? "{0} anotações passaram dos {1} dias e saíram." : "{0} anotação passou dos {1} dias e saiu.", [saiu.length, DIAS_DE_VIDA])}
            </strong>
            <small>{saiu.map((item) => item.titulo).join(" · ")}</small>
          </div>
          <button onClick={() => setSaiu([])} aria-label={t("Dispensar aviso")}>
            <X size={15} />
          </button>
        </div>
      )}

      <div className="relatorio-grade">
        {/* ── Anotações ──────────────────────────────────────────────── */}
        <section className="relatorio-bloco">
          <div className="relatorio-cabeca">
            <h2>{t("Anotações")}</h2>
            <span className="relatorio-regra">{t("somem em {0} dias", [DIAS_DE_VIDA])}</span>
          </div>

          <form className="relatorio-form" onSubmit={adicionarAnotacao}>
            <input
              value={titulo}
              onChange={(evento) => setTitulo(evento.target.value)}
              maxLength={200}
              placeholder={t("Nome da anotação")}
              aria-label={t("Nome da anotação")}
            />
            <textarea
              value={descricao}
              onChange={(evento) => setDescricao(evento.target.value)}
              maxLength={5000}
              placeholder={t("Descrição (opcional)")}
              aria-label={t("Descrição")}
            />
            <button type="submit" disabled={!titulo.trim()}>
              <Plus size={15} /> {t("Salvar")}
            </button>
          </form>

          {anotacoes.length === 0 ? (
            <p className="relatorio-vazio">{t("Nada anotado ainda. O que você escrever aqui fica por {0} dias.", [DIAS_DE_VIDA])}</p>
          ) : (
            <ul className="relatorio-lista">
              {anotacoes.map((item) => {
                const dias = diasRestantes(item);
                return (
                  <li key={item.id} className={dias <= 1 ? "acabando" : ""}>
                    <div className="relatorio-item-topo">
                      <strong>{item.titulo}</strong>
                      <span className="relatorio-prazo">{prazoEmPalavras(dias, t)}</span>
                    </div>
                    {item.descricao && <p>{item.descricao}</p>}
                    <div className="relatorio-item-pe">
                      {item.renovacoes > 0 && (
                        <small>{t("renovada {0}×", [item.renovacoes])}</small>
                      )}
                      <button
                        onClick={() =>
                          aplicar({
                            ...relatorio,
                            anotacoes: relatorio.anotacoes.map((a) => (a.id === item.id ? renovar(a) : a)),
                          })
                        }
                      >
                        <RotateCcw size={13} /> {t("mais {0} dias", [DIAS_DE_VIDA])}
                      </button>
                      <button
                        className="relatorio-apagar"
                        onClick={() =>
                          aplicar({ ...relatorio, anotacoes: relatorio.anotacoes.filter((a) => a.id !== item.id) })
                        }
                        aria-label={t("Apagar {0}", [item.titulo])}
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
            <h2>{t("Documentos · Espanha")}</h2>
            <span className="relatorio-regra">{t("{0} de {1}", [progresso.feitos, progresso.total])}</span>
          </div>

          {atencao.length > 0 && (
            <div className="relatorio-atencao" role="status">
              <CalendarClock size={15} />
              <div>
                <strong>
                  {t(atencao.length > 1 ? "{0} documentos pedindo atenção" : "{0} documento pedindo atenção", [atencao.length])}
                </strong>
                <small>
                  {atencao
                    .map((doc) => {
                      const dias = diasParaVencer(doc);
                      if (dias === null) return t(doc.nome);
                      return `${t(doc.nome)} — ${prazoDoDocumento(dias, t)}`;
                    })
                    .join(" · ")}
                </small>
              </div>
            </div>
          )}

          <p className="relatorio-origem">
            {t("Lista trazida por você, não conferida por mim. Os requisitos mudam por consulado, por curso e por categoria de vaga — confirme a lista vigente no Consulado-Geral da Espanha antes de pagar tradução, apostila ou taxa.")}
          </p>

          <form className="relatorio-form linha" onSubmit={adicionarDocumento}>
            <input
              value={novoDoc}
              onChange={(evento) => setNovoDoc(evento.target.value)}
              maxLength={200}
              placeholder={t("Acrescentar um documento")}
              aria-label={t("Nome do documento")}
            />
            <button type="submit" disabled={!novoDoc.trim()}>
              <Plus size={15} /> {t("Adicionar")}
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
                    <h3>{t(grupo.titulo)}</h3>
                    <p>{t(grupo.resumo)}</p>
                  </div>
                  <span className={`relatorio-quando ${grupo.agora ? "ja" : "depois"}`}>
                    {t(grupo.agora ? "dá para fazer agora" : "depende de uma oportunidade")}
                  </span>
                </header>

                <div className="relatorio-barra" role="img" aria-label={t("{0} de {1}", [p.feitos, p.total])}>
                  <span style={{ width: `${p.fracao * 100}%` }} />
                </div>

                {grupo.depende.length > 0 && (
                  <ul className="relatorio-depende">
                    {grupo.depende.map((item) => (
                      <li key={item}>{t(item)}</li>
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
                            <span>{t(doc.nome)}</span>
                          </button>

                          {anexos.length > 0 && <span className="relatorio-conta-anexo">{anexos.length}</span>}

                          <label
                            className={`relatorio-validade ${estadoValidade(doc)}`}
                            title={doc.validade ? t("Vale até {0}", [doc.validade]) : t("Definir até quando este documento vale")}
                          >
                            <CalendarClock size={14} />
                            <span className="sr-only">{t("Validade de {0}", [t(doc.nome)])}</span>
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

                          <label className="relatorio-anexar" title={t('Anexar arquivo a "{0}"', [t(doc.nome)])}>
                            <Paperclip size={14} />
                            <span className="sr-only">{t('Anexar arquivo a "{0}"', [t(doc.nome)])}</span>
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
                            aria-label={t("Remover {0}", [t(doc.nome)])}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <input
                          className="relatorio-nota"
                          value={doc.nota}
                          maxLength={1000}
                          placeholder={t("Observação — valor, onde tirar, protocolo…")}
                          aria-label={t("Observação de {0}", [t(doc.nome)])}
                          onChange={(evento) =>
                            aplicar({
                              ...relatorio,
                              documentos: relatorio.documentos.map((d) =>
                                d.id === doc.id ? definirNota(d, evento.target.value) : d,
                              ),
                            })
                          }
                        />

                        {anexos.length > 0 && (
                          <ul className="relatorio-anexos">
                            {anexos.map((ficha) => (
                              <li key={ficha.id}>
                                <button
                                  className="relatorio-baixar"
                                  onClick={() =>
                                    void baixar(ficha.id).then((achou) => {
                                      if (!achou) setAviso({ texto: "Esse arquivo não está mais guardado aqui." });
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
                                  aria-label={t("Remover o arquivo {0}", [ficha.nome])}
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
          {t(protegido(espelho)
            ? "As anotações, a checklist e os arquivos anexados têm cópia na sua conta: limpar este navegador não perde nada."
            : "Sem a cópia na conta, tudo isto vive só neste navegador — limpar os dados do site apaga tudo.")}
        </p>
        {fichas.length > 0 && (
          <p className="relatorio-espaco">
            <Paperclip size={12} /> {t(fichas.length > 1 ? "{0} arquivos guardados" : "{0} arquivo guardado", [fichas.length])} · {formatarTamanho(espacoUsado(fichas))}.{" "}
            <strong>{t("O exportar leva a checklist e as anotações, não os arquivos")}</strong>
            {t(" — para esses, use o botão de baixar em cada um e guarde a cópia onde você quiser.")}
          </p>
        )}
      </footer>

      {aviso && (
        <p className="relatorio-aviso" role="status">
          {t(aviso.texto, aviso.valores?.map((valor) => (typeof valor === "string" ? t(valor) : valor)))}
        </p>
      )}
    </div>
  );
}
