"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Bot,
  Check,
  Circle,
  Compass,
  GraduationCap,
  LayoutDashboard,
  Send,
  Sparkles,
  Video,
  WandSparkles,
  Zap,
} from "lucide-react";

export type CondorActivity = {
  id: string;
  title: string;
  project_slug: string | null;
  completed: boolean;
};

type Destination = "overview" | "site" | "videos" | "sat" | "university";

type CondorWorkspaceProps = {
  activities: CondorActivity[];
  onCreateActivity: (title: string, project: string | null) => Promise<boolean>;
  onToggleActivity: (activity: CondorActivity) => void;
  onNavigate: (destination: Destination) => void;
};

type Message = {
  id: number;
  role: "condor" | "user";
  text: string;
};

const destinations: Array<{ key: Destination; label: string; icon: typeof Compass }> = [
  { key: "site", label: "Site KauaArtx", icon: Compass },
  { key: "videos", label: "KauaArtx Video Studio", icon: Video },
  { key: "sat", label: "SAT & English Learning", icon: GraduationCap },
  { key: "university", label: "University Path", icon: GraduationCap },
];

const labels: Record<string, string> = {
  geral: "Geral",
  site: "Site KauaArtx",
  videos: "KauaArtx Video Studio",
  sat: "SAT & English Learning",
  university: "University Path",
  condor: "Condor AI",
};

function classify(text: string) {
  const value = text.toLocaleLowerCase("pt-BR");
  if (/vídeo|video|youtube|roteiro|thumbnail|gravar|edição|editar/.test(value)) return "videos";
  if (/oxford|faculdade|universidade|university|college|curso/.test(value)) return "university";
  if (/sat|inglês|ingles|prova|simulado|estudar/.test(value)) return "sat";
  if (/site|portfólio|portfolio|blog|página|pagina/.test(value)) return "site";
  return "geral";
}

function navigationCommand(text: string): Destination | null {
  const value = text.toLocaleLowerCase("pt-BR");
  if (!/abrir|abra|ir para|entrar/.test(value)) return null;
  if (/vídeo|video|youtube/.test(value)) return "videos";
  if (/university|universidade|oxford|faculdade/.test(value)) return "university";
  if (/sat|inglês|ingles/.test(value)) return "sat";
  if (/site|portfólio|portfolio|blog/.test(value)) return "site";
  if (/hub|visão geral|inicio|início/.test(value)) return "overview";
  return null;
}

export function CondorWorkspace({ activities, onCreateActivity, onToggleActivity, onNavigate }: CondorWorkspaceProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: "condor", text: "Estou pronto para organizar o Hub. Diga o que você precisa fazer ou qual sistema quer abrir." },
  ]);
  const openActivities = useMemo(() => activities.filter((activity) => !activity.completed), [activities]);

  async function submit(rawText?: string) {
    const text = (rawText ?? input).trim();
    if (!text || sending) return;
    setInput("");
    setMessages((current) => [...current, { id: Date.now(), role: "user", text }]);

    const destination = navigationCommand(text);
    if (destination) {
      const name = destination === "overview" ? "Visão geral" : destinations.find((item) => item.key === destination)?.label;
      setMessages((current) => [...current, { id: Date.now() + 1, role: "condor", text: `Certo. Abrindo ${name}.` }]);
      window.setTimeout(() => onNavigate(destination), 420);
      return;
    }

    if (/organizar|prepare|preparar|prioridade|meu dia|meu hub/.test(text.toLocaleLowerCase("pt-BR"))) {
      const summary = openActivities.length
        ? `Seu Hub tem ${openActivities.length} atividade${openActivities.length === 1 ? "" : "s"} em aberto. A próxima é: “${openActivities[0].title}”.`
        : "Seu Hub está livre. Diga o próximo objetivo e eu transformo em atividade.";
      setMessages((current) => [...current, { id: Date.now() + 1, role: "condor", text: summary }]);
      return;
    }

    setSending(true);
    const project = classify(text);
    const created = await onCreateActivity(text, project === "geral" ? null : project);
    setSending(false);
    setMessages((current) => [...current, {
      id: Date.now() + 1,
      role: "condor",
      text: created
        ? `Atividade criada em ${labels[project]}. Ela já está no foco do Hub.`
        : "Não consegui registrar agora. Tente novamente em alguns segundos.",
    }]);
  }

  return <section className="condor-workspace page-enter">
    <header className="condor-workspace-header">
      <div className="condor-identity">
        <span><Bot size={20} /></span>
        <div><small>INTELIGÊNCIA DO HUB</small><strong>Condor AI</strong></div>
      </div>
      <div className="condor-presence online"><i />Ativo no Hub</div>
    </header>

    <section className="condor-assistant-hero">
      <div>
        <p><Sparkles size={13} /> CENTRAL INTELIGENTE</p>
        <h1>Fale. O Condor organiza.</h1>
        <span>Crie atividades, prepare seu foco e abra qualquer sistema do ARTX Hub em uma só conversa.</span>
      </div>
      <div className="condor-hero-core" aria-hidden="true"><span>C</span><i /><i /></div>
    </section>

    <div className="condor-assistant-grid">
      <section className="condor-chat-panel">
        <header><div><WandSparkles size={17} /><span><strong>Conversa com o Condor</strong><small>Comandos do Hub</small></span></div><span className="condor-live"><i />ONLINE</span></header>
        <div className="condor-messages" aria-live="polite">
          {messages.map((message) => <div className={`condor-message ${message.role}`} key={message.id}>
            {message.role === "condor" && <span className="condor-avatar">C</span>}
            <p>{message.text}</p>
          </div>)}
          {sending && <div className="condor-message condor"><span className="condor-avatar">C</span><p className="condor-thinking"><i /><i /><i /></p></div>}
        </div>
        <div className="condor-suggestions">
          <button onClick={() => void submit("Preparar meu Hub")}>Preparar meu Hub</button>
          <button onClick={() => void submit("Criar roteiro para o próximo vídeo")}>Criar atividade de vídeo</button>
          <button onClick={() => void submit("Abrir University Path")}>Abrir University Path</button>
        </div>
        <form className="condor-composer" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ex.: preparar o roteiro do próximo vídeo" aria-label="Falar com o Condor" />
          <button type="submit" disabled={!input.trim() || sending} aria-label="Enviar ao Condor"><Send size={17} /></button>
        </form>
      </section>

      <aside className="condor-ready-panel">
        <header><div><Zap size={17} /><span><strong>Hub preparado</strong><small>{openActivities.length} atividade{openActivities.length === 1 ? "" : "s"} em aberto</small></span></div></header>
        <div className="condor-next-action">
          <small>PRÓXIMA AÇÃO</small>
          <strong>{openActivities[0]?.title ?? "Seu foco está livre"}</strong>
          <span>{openActivities[0] ? labels[openActivities[0].project_slug ?? "geral"] : "Converse com o Condor para começar"}</span>
        </div>
        <div className="condor-activity-list">
          {openActivities.slice(0, 5).map((activity) => <button key={activity.id} onClick={() => onToggleActivity(activity)}>
            <Circle size={15} /><span><strong>{activity.title}</strong><small>{labels[activity.project_slug ?? "geral"]}</small></span><Check size={14} />
          </button>)}
          {!openActivities.length && <div className="condor-empty"><Check size={18} /><span>Nenhuma atividade pendente.</span></div>}
        </div>
        <div className="condor-destinations">
          <small>ABRIR SISTEMA</small>
          <div>{destinations.map(({ key, label, icon: Icon }) => <button key={key} onClick={() => onNavigate(key)}><Icon size={15} /><span>{label}</span><ArrowRight size={13} /></button>)}</div>
        </div>
        <button className="condor-overview-button" onClick={() => onNavigate("overview")}><LayoutDashboard size={15} /> Voltar à visão geral</button>
      </aside>
    </div>
  </section>;
}
