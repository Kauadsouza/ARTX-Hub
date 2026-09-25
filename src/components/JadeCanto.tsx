"use client";

/**
 * A Jade no canto.
 *
 * O botão no topo levava para uma aba: sair do que se estava fazendo para
 * perguntar, e voltar depois. Aqui ela fica por cima, no canto, e some com Esc
 * — pergunta rápida sem perder o lugar.
 *
 * O QUE ELA PODE FAZER
 *
 * Uma lista fechada, definida em `lib/jade-acoes.ts`: criar atividade, criar
 * nota, concluir atividade e abrir uma aba. Fora dela não alcança nada.
 *
 * Concluir passa por confirmação. Criar e abrir não — são baratos de desfazer,
 * e pedir "tem certeza?" a cada nota transformaria a pressa que o painel
 * promete em três cliques.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Send, X } from "lucide-react";

import { descreverAcao, destinos, pedeConfirmacao, separarAcao, type Acao } from "@/lib/jade-acoes";
import { useI18n } from "./I18n";
import { JadeMarca } from "./JadeMarca";

type Mensagem = { role: "user" | "assistant"; content: string };

export type ExecutarAcao = (acao: Acao) => Promise<string>;

export function JadeCanto({
  accessToken,
  executar,
}: {
  accessToken: string | null;
  executar: ExecutarAcao;
}) {
  const { t } = useI18n();
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [entrada, setEntrada] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [pendente, setPendente] = useState<Acao | null>(null);

  /* Ligada ou não, perguntado ao abrir. `null` enquanto não se sabe: dizer
     "desligada" antes de conferir seria afirmar algo que ninguém verificou. */
  const [ligada, setLigada] = useState<boolean | null>(null);
  useEffect(() => {
    if (!aberto || ligada !== null) return;
    let vivo = true;
    fetch("/api/jade-assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: true }),
    })
      .then(async (resposta) => {
        const dados = await resposta.json().catch(() => ({}));
        if (vivo) setLigada(!(resposta.status === 503 && dados.error === "not_configured"));
      })
      .catch(() => {
        // Sem rede não dá para saber; o envio vai dizer o que houver.
        if (vivo) setLigada(true);
      });
    return () => {
      vivo = false;
    };
  }, [aberto, ligada]);
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  // Esc fecha, como qualquer coisa que se sobrepõe ao conteúdo.
  useEffect(() => {
    if (!aberto) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(false);
    }
    window.addEventListener("keydown", aoTeclar);
    campo.current?.focus();
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  useEffect(() => {
    if (aberto) fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens, aberto]);

  const aplicar = useCallback(
    async (acao: Acao) => {
      const resultado = await executar(acao);
      setMensagens((atual) => [...atual, { role: "assistant", content: resultado }]);
    },
    [executar],
  );

  async function enviar(texto: string) {
    const conteudo = texto.trim();
    if (!conteudo || enviando) return;
    if (!accessToken) {
      setMensagens((atual) => [...atual, { role: "assistant", content: t("Entre na conta para falar comigo.") }]);
      return;
    }

    const proximas = [...mensagens, { role: "user" as const, content: conteudo }];
    setMensagens(proximas);
    setEntrada("");
    setEnviando(true);

    try {
      const resposta = await fetch("/api/jade-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, messages: proximas, comAcoes: true }),
        signal: AbortSignal.timeout(35000),
      });
      const resultado = await resposta.json();

      if (resposta.status === 503 && resultado.error === "not_configured") {
        setLigada(false);
        setMensagens((atual) => [
          ...atual,
          { role: "assistant", content: t("Ainda não fui ligada: falta a chave ANTHROPIC_API_KEY no projeto.") },
        ]);
        return;
      }
      if (!resposta.ok) throw new Error(resultado.error || "falhou");

      const { texto: limpo, acao } = separarAcao(resultado.reply ?? "");
      setMensagens((atual) => [...atual, { role: "assistant", content: limpo }]);

      if (acao) {
        if (pedeConfirmacao(acao)) setPendente(acao);
        else await aplicar(acao);
      }
    } catch {
      setMensagens((atual) => [...atual, { role: "assistant", content: t("Não consegui responder agora. Tente de novo.") }]);
    } finally {
      setEnviando(false);
    }
  }

  if (!aberto) {
    return (
      <button className="jade-bolha" onClick={() => setAberto(true)} aria-label={t("Falar com a Jade")}>
        <JadeMarca tamanho={24} clara />
      </button>
    );
  }

  const estado =
    enviando ? t("Pensando…")
    : ligada === false ? t("Desligada — falta a chave da Anthropic")
    : ligada ? t("Pronta para ajudar")
    : t("Conferindo…");

  return (
    <aside className="jade-canto" role="dialog" aria-label={t("Jade")}>
      <header>
        <span className="jade-canto-marca"><JadeMarca tamanho={22} viva={enviando} /></span>
        <div>
          <strong>Jade</strong>
          <small className={`jade-canto-estado ${ligada === false ? "desligada" : enviando ? "pensando" : "pronta"}`}>
            <i aria-hidden /> {estado}
          </small>
        </div>
        <button onClick={() => setAberto(false)} aria-label={t("Fechar")}><X size={16} /></button>
      </header>

      <div className="jade-canto-conversa">
        {!mensagens.length && (
          <div className="jade-canto-boas-vindas">
            <JadeMarca tamanho={38} className="jade-canto-boas-vindas-marca" />
            <strong>{t("Oi, Kauã.")}</strong>
            <p>
              {ligada === false
                ? t("Ainda não fui ligada: falta a chave ANTHROPIC_API_KEY no projeto. Quando ela chegar, é só voltar aqui.")
                : t("Crio atividades, guardo notas, abro abas e respondo sobre o Hub. Começa por uma destas, ou escreve do teu jeito.")}
            </p>
            {ligada !== false && (
              <div className="jade-canto-sugestoes">
                {SUGESTOES.map((sugestao) => (
                  <button
                    key={sugestao.rotulo}
                    type="button"
                    onClick={() => {
                      if (sugestao.enviar) void enviar(sugestao.enviar);
                      else {
                        setEntrada(sugestao.preencher ?? "");
                        campo.current?.focus();
                      }
                    }}
                  >
                    {t(sugestao.rotulo)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {mensagens.map((mensagem, indice) => (
          <div key={indice} className={`jade-canto-linha ${mensagem.role}`}>
            {mensagem.role === "assistant" && (
              <span className="jade-canto-avatar"><JadeMarca tamanho={14} /></span>
            )}
            <div className={`jade-canto-msg ${mensagem.role}`}>{mensagem.content}</div>
          </div>
        ))}

        {enviando && (
          <div className="jade-canto-linha assistant">
            <span className="jade-canto-avatar"><JadeMarca tamanho={14} viva /></span>
            <div className="jade-canto-msg assistant pensando">{t("pensando")}<i /><i /><i /></div>
          </div>
        )}
        <div ref={fim} />
      </div>

      {/*
        A confirmação fica presa no rodapé, acima do campo: some do caminho da
        conversa, mas não dá para digitar outra coisa e esquecer que ficou uma
        decisão pendente.
      */}
      {pendente && (
        <div className="jade-canto-confirmar" role="alertdialog">
          <p>{descreverAcao(pendente)}</p>
          <div>
            <button
              className="quick-create"
              onClick={() => {
                const acao = pendente;
                setPendente(null);
                void aplicar(acao);
              }}
            >
              <Check size={14} /> {t("Confirmar")}
            </button>
            <button onClick={() => setPendente(null)}>{t("Agora não")}</button>
          </div>
        </div>
      )}

      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          void enviar(entrada);
        }}
      >
        <input
          ref={campo}
          value={entrada}
          onChange={(evento) => setEntrada(evento.target.value)}
          maxLength={2000}
          placeholder={ligada === false ? t("Desligada por enquanto") : t("Pergunte ou peça algo…")}
          disabled={enviando || ligada === false}
        />
        <button type="submit" disabled={enviando || !entrada.trim() || ligada === false} aria-label={t("Enviar")}>
          <Send size={15} />
        </button>
      </form>
    </aside>
  );
}

/**
 * Por onde começar.
 *
 * Um painel vazio com "pergunte algo" é o que deixa a conversa seca: ninguém
 * sabe o que pode pedir. As sugestões mostram o que ela faz de verdade — cada
 * uma cai numa das ações que existem — e as que precisam de um detalhe seu só
 * preenchem o campo, em vez de mandar uma frase pela metade.
 */
const SUGESTOES: Array<{ rotulo: string; enviar?: string; preencher?: string }> = [
  { rotulo: "O que eu faço agora?", enviar: "Olhando minhas atividades, o que eu deveria fazer agora?" },
  { rotulo: "Criar uma atividade", preencher: "Crie uma atividade: " },
  { rotulo: "Guardar uma ideia", preencher: "Guarde esta nota: " },
  { rotulo: "Abrir meus cursos", enviar: "Abra a aba de cursos." },
];

export { destinos };
