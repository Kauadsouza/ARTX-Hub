"use client";

import { useState } from "react";
import { Activity, ArrowUpRight, BookOpen, Check, Circle, Cloud, Download, Plus, RefreshCw, ShieldCheck, Video } from "lucide-react";
import { PersonalFocus } from "./PersonalFocus";

type Task = { id: string; title: string; project_slug: string | null; completed: boolean };
type Note = { id: string; content: string; created_at: string };
type View = "overview" | "site" | "videos" | "sat" | "university" | "condor";
type SystemSignal = { state: "ready" | "syncing" | "attention"; title: string; detail: string; updatedAt: string };
const labels: Record<string, string> = { geral: "Pessoal", sat: "Inglês", videos: "YouTube", site: "Site", university: "Faculdade", condor: "Condor" };

export function PersonalDashboard({ tasks, notes, systemSignals, syncError, syncing, onOpen, onCreate, onToggle, onNote, onRetry, onBackup }: {
  tasks: Task[]; notes: Note[]; systemSignals: Partial<Record<string, SystemSignal>>; syncError: string; syncing: boolean;
  onOpen: (view: View) => void; onCreate: (title: string, project: string) => Promise<boolean>;
  onToggle: (task: Task) => Promise<void>; onNote: (content: string) => Promise<boolean>; onRetry: () => void; onBackup: () => void;
}) {
  const [title, setTitle] = useState("");
  const [project, setProject] = useState("videos");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [notePending, setNotePending] = useState(false);
  const [filter, setFilter] = useState("open");
  const [toggling, setToggling] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [noteSearch, setNoteSearch] = useState("");
  const open = tasks.filter(task => !task.completed);
  const visible = tasks.filter(task => (filter === "all" || (filter === "done" ? task.completed : !task.completed)) && (category === "all" || (task.project_slug ?? "geral") === category) && task.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()));

  return <div className="overview-page personal-dashboard page-enter">
    <section className="personal-intro"><div><p className="eyebrow">KAUÃ · SEU ESPAÇO PESSOAL</p><h1>Crie. Aprenda.<br /><span>Continue de onde parou.</span></h1><p>Seu canal, suas ideias e um espaço para organizar o dia.</p></div><span className="day-label">{new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "Europe/London" }).format(new Date())}</span></section>
    {syncError && <div className="sync-alert" role="alert"><span>{syncError}</span><button onClick={onRetry}><RefreshCw size={15} /> Tentar novamente</button></div>}
    <section className="priority-grid">
      <button className="priority-card creator" onClick={() => onOpen("videos")}><div><Video size={23} /><span>01 / CRIAR</span><ArrowUpRight size={22} /></div><h2>O próximo vídeo<br />começa aqui.</h2><p>Ideias, roteiro, gravação e publicação.</p><strong>Abrir meu estúdio <ArrowUpRight size={17} /></strong></button>
      <button className="priority-card learner" onClick={() => onOpen("sat")}><div><BookOpen size={23} /><span>02 / APRENDER</span><ArrowUpRight size={22} /></div><h2>Um pouco de inglês.<br />Todos os dias.</h2><p>Plano diário, leitura, vocabulário e simulados.</p><strong>Continuar meus estudos <ArrowUpRight size={17} /></strong></button>
    </section>
    <section className="personal-links"><button onClick={() => onOpen("site")}><span>KAUAARTX</span><strong>Meu site</strong><ArrowUpRight size={18} /></button><button onClick={() => onOpen("university")}><span>UNIVERSITY PATH</span><strong>Minha faculdade</strong><ArrowUpRight size={18} /></button></section>
    <PersonalFocus tasks={tasks} onToggle={onToggle} onOpen={onOpen} />
    <section className="system-health"><div className="system-health-heading"><div><p className="eyebrow">SAÚDE DOS SISTEMAS</p><h2><Activity size={19} /> Estado real das integrações</h2></div><button onClick={onBackup}><Download size={15} /> Exportar Hub</button></div><div className="health-grid">{([['site','Meu site'],['videos','Vídeos'],['sat','Inglês'],['university','Faculdade']] as const).map(([key,label]) => { const signal = systemSignals[key]; return <button key={key} onClick={() => onOpen(key)} className={signal?.state ?? 'unknown'}><span><ShieldCheck size={16} />{label}<i /></span><strong>{signal?.title ?? 'Abrir para verificar'}</strong><small>{signal?.detail ?? 'O Hub registra aqui o último estado confirmado pelo sistema.'}</small>{signal?.updatedAt && <time dateTime={signal.updatedAt}>{new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'}).format(new Date(signal.updatedAt))}</time>}</button>; })}</div></section>
    <section className="organizer-grid">
      <article className="organizer-panel"><div className="organizer-heading"><div><p className="eyebrow">PRÓXIMOS PASSOS</p><h2>Meu foco <small>{open.length} em aberto</small></h2></div><select aria-label="Filtrar atividades" value={filter} onChange={event => setFilter(event.target.value)}><option value="open">Em aberto</option><option value="done">Concluídas</option><option value="all">Todas</option></select></div>
        <form className="task-composer" onSubmit={async event => { event.preventDefault(); if (pending) return; setPending(true); try { if (await onCreate(title, project)) setTitle(""); } finally { setPending(false); } }}><label className="sr-only" htmlFor="activity-title">Nova atividade</label><input id="activity-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={500} required placeholder="Qual é o próximo passo?" /><div><select aria-label="Projeto da atividade" value={project} onChange={event => setProject(event.target.value)}>{Object.entries(labels).filter(([key]) => key !== "condor").map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button type="submit" disabled={pending || !title.trim()}><Plus size={16} />{pending ? "Salvando…" : "Adicionar"}</button></div></form>
        <div className="personal-filters"><input aria-label="Buscar atividades" placeholder="Buscar uma atividade…" value={search} onChange={event => setSearch(event.target.value)} /><select aria-label="Filtrar por área" value={category} onChange={event => setCategory(event.target.value)}><option value="all">Todas as áreas</option>{Object.entries(labels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></div><div className="personal-task-list">{visible.map(task => <button disabled={toggling === task.id} className={task.completed ? "done" : ""} key={task.id} onClick={async () => { setToggling(task.id); try { await onToggle(task); } finally { setToggling(null); } }} aria-label={`${task.completed ? "Reabrir" : "Concluir"}: ${task.title}`}>{task.completed ? <Check size={18} /> : <Circle size={18} />}<span>{task.title}</span><small>{labels[task.project_slug ?? "geral"] ?? "Pessoal"}</small></button>)}{!visible.length && <p className="organizer-empty">{syncing ? "Carregando suas atividades…" : "Nenhuma atividade nesta lista. Adicione seu próximo passo acima."}</p>}</div>
      </article>
      <article className="organizer-panel"><div className="organizer-heading"><div><p className="eyebrow">IDEIAS QUE VALEM GUARDAR</p><h2>Bloco de notas</h2></div><Cloud size={18} /></div><form className="note-composer" onSubmit={async event => { event.preventDefault(); if (notePending) return; setNotePending(true); try { if (await onNote(note)) setNote(""); } finally { setNotePending(false); } }}><label className="sr-only" htmlFor="quick-note">Nova nota</label><textarea id="quick-note" maxLength={5000} required value={note} onChange={event => setNote(event.target.value)} placeholder="Uma ideia de vídeo, uma palavra nova, algo para lembrar…" /><button disabled={notePending || !note.trim()}>{notePending ? "Salvando…" : "Guardar nota"}<Plus size={15} /></button></form><input className="personal-note-search" aria-label="Buscar notas" placeholder="Encontrar uma anotação…" value={noteSearch} onChange={event=>setNoteSearch(event.target.value)} /><div className="personal-note-list">{notes.filter(item=>item.content.toLocaleLowerCase().includes(noteSearch.toLocaleLowerCase())).map(item => <article key={item.id}><p>{item.content}</p><time dateTime={item.created_at}>{new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" }).format(new Date(item.created_at))}</time></article>)}{!notes.length && <p className="organizer-empty">Suas notas aparecerão aqui depois de salvas.</p>}</div></article>
    </section>
  </div>;
}
