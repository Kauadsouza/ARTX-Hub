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
import { AlertTriangle, Check, Circle, Download, Plus, RotateCcw, Trash2, Upload, X } from "lucide-react";

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
  relatorioVazio,
  renovar,
  unir,
  type Anotacao,
  type Relatorio,
} from "@/lib/relatorio";

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

  // Lê e já limpa o que passou do prazo, guardando o que saiu para contar.
  useEffect(() => {
    const lido = ler(typeof window === "undefined" ? null : localStorage.getItem(CHAVE));
    const { relatorio: limpo, removidas } = expurgar(lido);
    setRelatorio(limpo);
    setSaiu(removidas);
    if (removidas.length > 0) guardar(limpo);
    setPronto(true);
  }, []);

  function aplicar(proximo: Relatorio) {
    setRelatorio(proximo);
    guardar(proximo);
  }

  const anotacoes = useMemo(() => porUrgencia(relatorio.anotacoes), [relatorio.anotacoes]);
  const progresso = progressoDocumentos(relatorio.documentos);

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
            {progresso.total > 0 && (
              <span className="relatorio-regra">
                {progresso.feitos} de {progresso.total}
              </span>
            )}
          </div>

          {progresso.total > 0 && (
            <div className="relatorio-barra" role="img" aria-label={`${Math.round(progresso.fracao * 100)}% pronto`}>
              <span style={{ width: `${progresso.fracao * 100}%` }} />
            </div>
          )}

          <form className="relatorio-form linha" onSubmit={adicionarDocumento}>
            <input
              value={novoDoc}
              onChange={(evento) => setNovoDoc(evento.target.value)}
              maxLength={200}
              placeholder="Qual documento?"
              aria-label="Nome do documento"
            />
            <button type="submit" disabled={!novoDoc.trim()}>
              <Plus size={15} /> Adicionar
            </button>
          </form>

          {relatorio.documentos.length === 0 ? (
            <p className="relatorio-vazio">
              A lista está vazia. Vá acrescentando conforme descobrir o que precisa — ou me mande a lista que eu
              coloco de uma vez.
            </p>
          ) : (
            <ul className="relatorio-docs">
              {relatorio.documentos.map((doc) => (
                <li key={doc.id} className={doc.feito ? "feito" : ""}>
                  <button
                    className="relatorio-marcar"
                    onClick={() =>
                      aplicar({
                        ...relatorio,
                        documentos: relatorio.documentos.map((d) => (d.id === doc.id ? alternarDocumento(d) : d)),
                      })
                    }
                    aria-pressed={doc.feito}
                  >
                    {doc.feito ? <Check size={16} /> : <Circle size={16} />}
                    <span>{doc.nome}</span>
                  </button>
                  <button
                    className="relatorio-apagar"
                    onClick={() =>
                      aplicar({ ...relatorio, documentos: relatorio.documentos.filter((d) => d.id !== doc.id) })
                    }
                    aria-label={`Remover ${doc.nome}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="relatorio-rodape">
        Isto vive só neste navegador — sem conta e sem servidor, como você pediu. Limpar os dados do site apaga tudo,
        então exporte de vez em quando.
      </p>

      {aviso && (
        <p className="relatorio-aviso" role="status">
          {aviso}
        </p>
      )}
    </div>
  );
}
