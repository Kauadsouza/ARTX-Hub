"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Bot, Check, Circle, Monitor, Plus, ShieldCheck, Mic, Smartphone } from "lucide-react";
import { useI18n } from "./I18n";

export type CondorActivity = { id: string; title: string; project_slug: string | null; completed: boolean };
type Props = {
  localMode: boolean;
  activities: CondorActivity[];
  onCreateActivity: (title: string, project: string | null) => Promise<boolean>;
  onToggleActivity: (activity: CondorActivity) => void;
};

export function CondorWorkspace({ localMode, activities, onCreateActivity, onToggleActivity }: Props) {
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
    <header className="condor-workspace-header"><div className="condor-identity"><span><Bot size={20} /></span><div><small>{en ? "YOUR PERSONAL ASSISTANT" : "SEU ASSISTENTE PESSOAL"}</small><strong>Condor</strong></div></div><span className="condor-origin"><Monitor size={14} />{localMode ? (en ? "Local app" : "Aplicativo local") : (en ? "Runs on your PC" : "Roda no seu PC")}</span></header>
    <div className="condor-assistant-grid">
      <section className="condor-chat-panel condor-real-chat">
        {localMode ? <iframe src="/ui/index.html" title={en ? "Condor local conversation" : "Conversa local com o Condor"} allow="microphone 'self'" /> : <div className="condor-connect-panel">
          <span className="condor-connect-mark"><Bot size={34} /></span><small>CONDOR + ARTX HUB</small>
          <h1>{en ? "Think it through. Make it happen." : "Pense junto. Coloque em prática."}</h1>
          <p>{en ? "Chat, use voice and work with your computer through your local Condor. Choose a local model or connect your own provider key." : "Converse, use voz e trabalhe com seu computador pelo Condor local. Escolha um modelo no PC ou conecte a chave do seu provedor."}</p>
          <a className="condor-launch" href="condor://open"><ArrowUpRight size={17} />{en ? "Open Condor on this PC" : "Abrir Condor neste PC"}</a>
          <p className="condor-launch-help">{en ? "Requires the Condor desktop integration. If it does not open, launch Condor from the Windows Start menu. This web Hub cannot verify whether your PC is online." : "Requer a integração do Condor com o Windows. Se não abrir, inicie o Condor pelo menu Iniciar. Este Hub web não verifica se o seu PC está ligado."}</p>
          <div className="condor-capabilities"><span><Mic size={17} />{en ? "Voice on your PC" : "Voz no PC"}</span><span><ShieldCheck size={17} />{en ? "Local permissions" : "Permissões locais"}</span><span><Smartphone size={17} />{en ? "iPhone: setup required" : "iPhone: configurar acesso"}</span></div>
        </div>}
      </section>
      <aside className="condor-ready-panel"><header><strong>{en ? "Your next steps" : "Seus próximos passos"}</strong><small>{open.length} {en ? "open tasks" : "atividades em aberto"}</small></header>
        <div className="condor-activity-list">{open.slice(0,6).map(item=><button key={item.id} onClick={()=>onToggleActivity(item)}><Circle size={15}/><span><strong>{item.title}</strong></span><Check size={14}/></button>)}{!open.length&&<p className="condor-empty">{en ? "No outstanding tasks." : "Nenhuma atividade pendente."}</p>}</div>
        <form className="condor-task-form" onSubmit={e=>{e.preventDefault();void create();}}><label htmlFor="condorTask">{en ? "Add a task to the Hub" : "Adicionar atividade ao Hub"}</label><input id="condorTask" value={title} onChange={e=>setTitle(e.target.value)} maxLength={500} required placeholder={en ? "Your next step…" : "Seu próximo passo…"}/><button disabled={saving||!title.trim()}><Plus size={15}/>{saving ? (en?"Saving…":"Salvando…") : (en?"Add task":"Adicionar atividade")}</button><p role="status">{feedback}</p></form>
        <div className="condor-boundary-note"><ShieldCheck size={18}/><p>{en ? "The Hub and Condor keep their own permissions. Device actions run through the authenticated local app." : "O Hub e o Condor mantêm suas próprias permissões. As ações nos aparelhos passam pelo aplicativo local autenticado."}</p></div>
      </aside>
    </div>
  </section>;
}

