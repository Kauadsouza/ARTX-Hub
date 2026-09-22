"use client";

/**
 * A Jade.
 *
 * A inteligência do Hub. Uma só em todo o ecossistema: aqui ela conhece o Hub,
 * no University Path ela responde sobre admissão.
 *
 * Esta tela nasceu de outro assistente que morava aqui antes, e a herança
 * deixou coisas que não faziam mais sentido: um modo local que carregava um
 * aplicativo que não existe mais, um link para um protocolo que o app de
 * desktop hoje recusa, e um aviso explicando uma fronteira entre dois
 * assistentes quando só resta um. Tudo isso saiu — o que fica é o que a Jade
 * de fato faz.
 *
 * O que ela não faz também está escrito na tela, porque um assistente que
 * deixa a pessoa supor o alcance dele acaba decepcionando na primeira pergunta
 * fora dele.
 */

import { useMemo, useRef, useState } from "react";
import { Check, Circle, Plus, Send, Sparkles } from "lucide-react";
import { useI18n } from "./I18n";

export type JadeActivity = { id: string; title: string; project_slug: string | null; completed: boolean };

type Props = {
  accessToken: string | null;
  activities: JadeActivity[];
  onCreateActivity: (title: string, project: string | null) => Promise<boolean>;
  onToggleActivity: (activity: JadeActivity) => void;
};

type ChatMessage = { role: "user" | "assistant"; content: string };

function Conversa({ accessToken }: { accessToken: string | null }) {
  const { locale } = useI18n();
  const en = locale === "en";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState("");
  const fim = useRef<HTMLDivElement>(null);

  const suggestions = en
    ? ["What should I improve first?", "Summarize pending account requests", "Ideas for the courses tab"]
    : ["O que devo melhorar primeiro?", "Resuma os pedidos de conta pendentes", "Ideias para a aba de cursos"];

  async function send(text: string) {
    const content = text.trim();
    if (!content || sending) return;
    if (!accessToken) {
      setError(en ? "Sign in again to talk to Jade." : "Entre novamente para falar com a Jade.");
      return;
    }
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/jade-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, messages: next }),
        signal: AbortSignal.timeout(35000),
      });
      const result = await response.json();
      if (response.status === 503 && result.error === "not_configured") {
        setNotConfigured(true);
        return;
      }
      if (!response.ok) throw new Error(result.error || "failed");
      setMessages((current) => [...current, { role: "assistant", content: result.reply || "" }]);
    } catch {
      setError(en ? "Could not reach Jade. Try again." : "Não consegui falar com a Jade. Tente de novo.");
    } finally {
      setSending(false);
      // A resposta chega embaixo; sem isto a pessoa precisa rolar para ler.
      requestAnimationFrame(() => fim.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
    }
  }

  if (notConfigured) {
    return (
      <div className="jade-connect-panel">
        <span className="jade-connect-mark">
          <Sparkles size={34} />
        </span>
        <small>{en ? "JADE · HUB INTELLIGENCE" : "JADE · INTELIGÊNCIA DO HUB"}</small>
        <h1>{en ? "Not switched on yet." : "Ainda não ligada."}</h1>
        <p>
          {en
            ? "Add an ANTHROPIC_API_KEY environment variable to the project to turn Jade on. Everything else on the Hub keeps working without it."
            : "Adicione a variável de ambiente ANTHROPIC_API_KEY ao projeto para ligar a Jade. O resto do Hub continua funcionando sem ela."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="jade-messages">
        {!messages.length && (
          <p className="jade-empty">
            {en ? "Ask about improving or using the Hub." : "Pergunte sobre melhorar ou usar o Hub."}
          </p>
        )}
        {messages.map((message, index) => (
          <div key={index} className={`jade-message${message.role === "user" ? " user" : ""}`}>
            {message.role === "assistant" && <span className="jade-avatar">J</span>}
            <p>{message.content}</p>
          </div>
        ))}
        {sending && (
          <div className="jade-message">
            <span className="jade-avatar">J</span>
            <div className="jade-thinking">
              <i />
              <i />
              <i />
            </div>
          </div>
        )}
        <div ref={fim} />
      </div>

      {!messages.length && (
        <div className="jade-suggestions">
          {suggestions.map((item) => (
            <button key={item} type="button" onClick={() => void send(item)}>
              {item}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="status" className="jade-assistant-error">
          {error}
        </p>
      )}

      <form
        className="jade-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          maxLength={4000}
          placeholder={en ? "Ask Jade…" : "Pergunte à Jade…"}
          disabled={sending}
        />
        <button type="submit" disabled={sending || !input.trim()} aria-label={en ? "Send" : "Enviar"}>
          <Send size={16} />
        </button>
      </form>
    </>
  );
}

export function JadeWorkspace({ accessToken, activities, onCreateActivity, onToggleActivity }: Props) {
  const { locale } = useI18n();
  const en = locale === "en";
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const open = useMemo(() => activities.filter((item) => !item.completed), [activities]);

  async function create() {
    if (saving || !title.trim()) return;
    setSaving(true);
    try {
      if (await onCreateActivity(title.trim(), null)) {
        setTitle("");
        setFeedback(en ? "Task created." : "Atividade criada.");
      } else {
        setFeedback(en ? "Could not save. Try again." : "Não foi possível salvar. Tente novamente.");
      }
    } catch {
      setFeedback(en ? "Connection failed. Your text is preserved." : "Falha de conexão. Seu texto foi preservado.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="jade-workspace page-enter">
      <header className="jade-assistant-hero">
        <div>
          <p>
            <Sparkles size={12} /> {en ? "HUB INTELLIGENCE" : "INTELIGÊNCIA DO HUB"}
          </p>
          <h1>Jade</h1>
          <span>
            {en
              ? "She knows this Hub: what you have built, what is pending and how the systems fit together. Ask what to improve first, or turn an idea into a task without leaving the conversation."
              : "Ela conhece este Hub: o que você já construiu, o que está pendente e como os sistemas se encaixam. Pergunte o que melhorar primeiro, ou transforme uma ideia em atividade sem sair da conversa."}
          </span>
        </div>
        <div className="jade-hero-core" aria-hidden>
          <span>J</span>
          <i />
          <i />
        </div>
      </header>

      <div className="jade-assistant-grid">
        <section className="jade-chat-panel jade-real-chat">
          <Conversa accessToken={accessToken} />
        </section>

        <aside className="jade-ready-panel">
          <header>
            <strong>{en ? "Your next steps" : "Seus próximos passos"}</strong>
            <small>
              {open.length} {en ? "open tasks" : "atividades em aberto"}
            </small>
          </header>

          <div className="jade-activity-list">
            {open.slice(0, 6).map((item) => (
              <button key={item.id} onClick={() => onToggleActivity(item)}>
                <Circle size={15} />
                <span>
                  <strong>{item.title}</strong>
                </span>
                <Check size={14} />
              </button>
            ))}
            {!open.length && (
              <p className="jade-empty">{en ? "No outstanding tasks." : "Nenhuma atividade pendente."}</p>
            )}
          </div>

          <form
            className="jade-task-form"
            onSubmit={(event) => {
              event.preventDefault();
              void create();
            }}
          >
            <label htmlFor="jadeTask">{en ? "Add a task to the Hub" : "Adicionar atividade ao Hub"}</label>
            <input
              id="jadeTask"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={500}
              required
              placeholder={en ? "Your next step…" : "Seu próximo passo…"}
            />
            <button disabled={saving || !title.trim()}>
              <Plus size={15} />
              {saving ? (en ? "Saving…" : "Salvando…") : en ? "Add task" : "Adicionar atividade"}
            </button>
            <p role="status">{feedback}</p>
          </form>

          {/*
            O alcance dela, dito na tela.

            Um assistente que deixa a pessoa supor o que ele alcança decepciona
            na primeira pergunta de fora. A Jade lê o Hub; não lê o computador.
          */}
          <div className="jade-boundary-note">
            <Sparkles size={18} />
            <p>
              {en
                ? "Jade reads this Hub and your account data. She has no access to files on your computer."
                : "A Jade lê este Hub e os dados da sua conta. Ela não tem acesso aos arquivos do seu computador."}
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
