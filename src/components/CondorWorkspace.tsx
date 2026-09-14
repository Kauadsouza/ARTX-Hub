"use client";

import { useMemo, useState } from "react";
import { Bot, Check, Circle, Monitor, Plus, ShieldCheck, Send } from "lucide-react";
import { useI18n } from "./I18n";

export type CondorActivity = { id: string; title: string; project_slug: string | null; completed: boolean };
type Props = {
  localMode: boolean;
  accessToken: string | null;
  activities: CondorActivity[];
  onCreateActivity: (title: string, project: string | null) => Promise<boolean>;
  onToggleActivity: (activity: CondorActivity) => void;
};

type ChatMessage = { role: "user" | "assistant"; content: string };

function HubAssistant({ accessToken }: { accessToken: string | null }) {
  const { locale } = useI18n();
  const en = locale === "en";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState("");

  const suggestions = en
    ? ["What should I improve first?", "Summarize pending account requests", "Ideas for the courses tab"]
    : ["O que devo melhorar primeiro?", "Resuma os pedidos de conta pendentes", "Ideias para a aba de cursos"];

  async function send(text: string) {
    const content = text.trim();
    if (!content || sending) return;
    if (!accessToken) { setError(en ? "Sign in again to use the assistant." : "Entre novamente para usar o assistente."); return; }
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/condor-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, messages: next }),
        signal: AbortSignal.timeout(35000),
      });
      const result = await response.json();
      if (response.status === 503 && result.error === "not_configured") { setNotConfigured(true); return; }
      if (!response.ok) throw new Error(result.error || "failed");
      setMessages(current => [...current, { role: "assistant", content: result.reply || "" }]);
    } catch {
      setError(en ? "Could not reach the assistant. Try again." : "Não foi possível falar com o assistente. Tente de novo.");
    } finally {
      setSending(false);
    }
  }

  if (notConfigured) {
    return <div className="condor-connect-panel">
      <span className="condor-connect-mark"><Bot size={34} /></span><small>{en ? "HUB ASSISTANT" : "ASSISTENTE DO HUB"}</small>
      <h1>{en ? "Not configured yet." : "Ainda não configurado."}</h1>
      <p>{en ? "Add an ANTHROPIC_API_KEY environment variable to the project to turn this on. Everything else on the Hub keeps working without it." : "Adicione a variável de ambiente ANTHROPIC_API_KEY ao projeto para ativar. O resto do Hub continua funcionando sem ela."}</p>
    </div>;
  }

  return <>
    <div className="condor-messages">
      {!messages.length && <p className="condor-empty">{en ? "Ask about improving or using the Hub." : "Pergunte sobre melhorias ou o uso do Hub."}</p>}
      {messages.map((message, index) => <div key={index} className={`condor-message${message.role === "user" ? " user" : ""}`}>
        {message.role === "assistant" && <span className="condor-avatar">C</span>}
        <p>{message.content}</p>
      </div>)}
      {sending && <div className="condor-message"><span className="condor-avatar">C</span><div className="condor-thinking"><i /><i /><i /></div></div>}
    </div>
    {!messages.length && <div className="condor-suggestions">{suggestions.map(item => <button key={item} type="button" onClick={() => void send(item)}>{item}</button>)}</div>}
    {error && <p role="status" className="condor-assistant-error">{error}</p>}
    <form className="condor-composer" onSubmit={event => { event.preventDefault(); void send(input); }}>
      <input value={input} onChange={event => setInput(event.target.value)} maxLength={4000} placeholder={en ? "Ask the Hub assistant…" : "Pergunte ao assistente do Hub…"} disabled={sending} />
      <button type="submit" disabled={sending || !input.trim()} aria-label={en ? "Send" : "Enviar"}><Send size={16} /></button>
    </form>
    <div className="condor-boundary-note"><Monitor size={16} /><p>{en ? "This assistant only knows about the Hub. For your personal Condor with its own memory, " : "Este assistente só conhece o Hub. Para o seu Condor pessoal, com memória própria, "}<a href="condor://open">{en ? "open it on this PC ↗" : "abra ele neste PC ↗"}</a>.</p></div>
  </>;
}

export function CondorWorkspace({ localMode, accessToken, activities, onCreateActivity, onToggleActivity }: Props) {
  const { locale } = useI18n();
  const en = locale === "en";
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const open = useMemo(() => activities.filter(item => !item.completed), [activities]);

  async function create() {
    if (saving || !title.trim()) return;
    setSaving(true);
    try {
      if (await onCreateActivity(title.trim(), null)) { setTitle(""); setFeedback(en ? "Task created." : "Atividade criada."); }
      else setFeedback(en ? "Could not save. Try again." : "Não foi possível salvar. Tente novamente.");
    } catch { setFeedback(en ? "Connection failed. Your text is preserved." : "Falha de conexão. Seu texto foi preservado."); }
    finally { setSaving(false); }
  }

  return <section className="condor-workspace page-enter">
    <header className="condor-workspace-header"><div className="condor-identity"><span><Bot size={20} /></span><div><small>{localMode ? (en ? "YOUR PERSONAL ASSISTANT" : "SEU ASSISTENTE PESSOAL") : (en ? "HUB ASSISTANT" : "ASSISTENTE DO HUB")}</small><strong>{localMode ? "Condor" : (en ? "Hub Copilot" : "Copiloto do Hub")}</strong></div></div><span className="condor-origin"><Monitor size={14} />{localMode ? (en ? "Local app" : "Aplicativo local") : (en ? "Improves this Hub" : "Melhora este Hub")}</span></header>
    <div className="condor-assistant-grid">
      <section className="condor-chat-panel condor-real-chat">
        {localMode ? <iframe src="/ui/index.html" title={en ? "Condor local conversation" : "Conversa local com o Condor"} allow="microphone 'self'" /> : <HubAssistant accessToken={accessToken} />}
      </section>
      <aside className="condor-ready-panel"><header><strong>{en ? "Your next steps" : "Seus próximos passos"}</strong><small>{open.length} {en ? "open tasks" : "atividades em aberto"}</small></header>
        <div className="condor-activity-list">{open.slice(0,6).map(item=><button key={item.id} onClick={()=>onToggleActivity(item)}><Circle size={15}/><span><strong>{item.title}</strong></span><Check size={14}/></button>)}{!open.length&&<p className="condor-empty">{en ? "No outstanding tasks." : "Nenhuma atividade pendente."}</p>}</div>
        <form className="condor-task-form" onSubmit={e=>{e.preventDefault();void create();}}><label htmlFor="condorTask">{en ? "Add a task to the Hub" : "Adicionar atividade ao Hub"}</label><input id="condorTask" value={title} onChange={e=>setTitle(e.target.value)} maxLength={500} required placeholder={en ? "Your next step…" : "Seu próximo passo…"}/><button disabled={saving||!title.trim()}><Plus size={15}/>{saving ? (en?"Saving…":"Salvando…") : (en?"Add task":"Adicionar atividade")}</button><p role="status">{feedback}</p></form>
        <div className="condor-boundary-note"><ShieldCheck size={18}/><p>{en ? "The Hub and Condor keep their own permissions. Device actions run through the authenticated local app." : "O Hub e o Condor mantêm suas próprias permissões. As ações nos aparelhos passam pelo aplicativo local autenticado."}</p></div>
      </aside>
    </div>
  </section>;
}
