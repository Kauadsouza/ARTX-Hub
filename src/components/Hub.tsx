"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Circle,
  ClipboardList,
  Compass,
  ExternalLink,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MonitorCog,
  PanelLeft,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  StickyNote,
  Video,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Note = { id: string; content: string; project_slug: string | null; created_at: string };
type Task = { id: string; title: string; project_slug: string | null; completed: boolean };
type View = "overview" | "site" | "videos" | "sat" | "condor" | "notes";
type ProjectKey = "site" | "videos" | "sat" | "condor" | "geral";

const workspaces: Record<Exclude<View, "overview" | "notes">, {
  label: string;
  eyebrow: string;
  description: string;
  url?: string;
  project: ProjectKey;
  icon: typeof Compass;
  accent: string;
}> = {
  site: {
    label: "Meu site",
    eyebrow: "PRESENÇA PÚBLICA",
    description: "Acompanhe seu site ao vivo e registre melhorias enquanto navega.",
    url: "https://kauaartx.vercel.app",
    project: "site",
    icon: Compass,
    accent: "sky",
  },
  videos: {
    label: "Sistema de Vídeos",
    eyebrow: "ESTÚDIO DE CONTEÚDO",
    description: "Planeje roteiros, avance vídeos pelo fluxo e organize sua produção sem sair do Hub.",
    url: "https://sistema-videos.vercel.app",
    project: "videos",
    icon: Video,
    accent: "violet",
  },
  sat: {
    label: "SAT & Inglês",
    eyebrow: "ÁREA DE ESTUDOS",
    description: "Faça simulados, acompanhe sua evolução e concentre sua rotina de estudo aqui.",
    url: "https://sat-simulado.vercel.app",
    project: "sat",
    icon: GraduationCap,
    accent: "amber",
  },
  condor: {
    label: "Condor",
    eyebrow: "ASSISTENTE LOCAL",
    description: "O Condor continua no seu PC para manter acesso local aos seus arquivos, voz e automações.",
    project: "condor",
    icon: MonitorCog,
    accent: "mint",
  },
};

const projectLabels: Record<ProjectKey, string> = {
  geral: "Geral",
  site: "Meu site",
  videos: "Sistema de Vídeos",
  sat: "SAT & Inglês",
  condor: "Condor",
};

export function Hub() {
  const supabase = useMemo(createClient, []);
  const [sessionReady, setSessionReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [activeView, setActiveView] = useState<View>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [noteText, setNoteText] = useState("");
  const [taskText, setTaskText] = useState("");
  const [project, setProject] = useState<ProjectKey>("geral");

  useEffect(() => {
    if (!supabase) { setSessionReady(true); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
      setSessionReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setSignedIn(Boolean(session));
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !signedIn) return;
    void loadWorkspace();
    // The database is intentionally the single source of truth across PC and phone.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, supabase]);

  async function loadWorkspace() {
    if (!supabase) return;
    const [noteResult, taskResult] = await Promise.all([
      supabase.from("hub_notes").select("*").order("created_at", { ascending: false }).limit(24),
      supabase.from("hub_tasks").select("*").order("created_at", { ascending: false }).limit(24),
    ]);
    setNotes((noteResult.data as Note[]) ?? []);
    setTasks((taskResult.data as Task[]) ?? []);
  }

  async function login(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setMessage("Entrando...");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setMessage(error ? "E-mail ou senha inválidos." : "");
  }

  async function resetPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    if (newPassword.length < 8) { setMessage("Use pelo menos 8 caracteres na nova senha."); return; }
    setMessage("Salvando nova senha...");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { setMessage("Não foi possível atualizar a senha. Abra o link do e-mail novamente."); return; }
    setMessage("");
    setNewPassword("");
    setRecoveryMode(false);
  }

  async function addNote() {
    if (!supabase || !noteText.trim()) return;
    const { data, error } = await supabase
      .from("hub_notes")
      .insert({ content: noteText.trim(), project_slug: project === "geral" ? null : project })
      .select()
      .single();
    if (!error && data) {
      setNotes((current) => [data as Note, ...current]);
      setNoteText("");
    }
  }

  async function addTask() {
    if (!supabase || !taskText.trim()) return;
    const { data, error } = await supabase
      .from("hub_tasks")
      .insert({ title: taskText.trim(), project_slug: project === "geral" ? null : project })
      .select()
      .single();
    if (!error && data) {
      setTasks((current) => [data as Task, ...current]);
      setTaskText("");
    }
  }

  async function toggleTask(task: Task) {
    if (!supabase) return;
    const completed = !task.completed;
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed } : item));
    await supabase.from("hub_tasks").update({ completed }).eq("id", task.id);
  }

  function goTo(view: View) {
    setActiveView(view);
    setSidebarOpen(false);
    if (view in workspaces) setProject(workspaces[view as keyof typeof workspaces].project);
  }

  if (!sessionReady) return <main className="loading">Abrindo seu espaço...</main>;
  if (!supabase) return <SetupScreen />;
  if (recoveryMode) return <ResetPassword password={newPassword} message={message} onPassword={setNewPassword} onSubmit={resetPassword} />;
  if (!signedIn) return <Login email={email} password={password} message={message} onEmail={setEmail} onPassword={setPassword} onSubmit={login} />;

  const current = activeView in workspaces ? workspaces[activeView as keyof typeof workspaces] : null;
  const openTasks = tasks.filter((task) => !task.completed).length;
  const scopedNotes = current ? notes.filter((note) => note.project_slug === current.project) : notes;
  const scopedTasks = current ? tasks.filter((task) => task.project_slug === current.project) : tasks;

  return <main className="hub-shell">
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="sidebar-top">
        <button className="brand" onClick={() => goTo("overview")}><span>ARTX</span> Hub</button>
        <button className="icon-button close-menu" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu"><X size={18} /></button>
      </div>
      <p className="side-label">ÁREA DE TRABALHO</p>
      <nav className="nav-list">
        <NavButton active={activeView === "overview"} icon={LayoutDashboard} label="Visão geral" onClick={() => goTo("overview")} />
        <NavButton active={activeView === "site"} icon={Compass} label="Meu site" onClick={() => goTo("site")} />
        <NavButton active={activeView === "videos"} icon={Video} label="Sistema de Vídeos" onClick={() => goTo("videos")} />
        <NavButton active={activeView === "sat"} icon={GraduationCap} label="SAT & Inglês" onClick={() => goTo("sat")} />
        <NavButton active={activeView === "condor"} icon={MonitorCog} label="Condor" onClick={() => goTo("condor")} />
      </nav>
      <p className="side-label side-label-bottom">ORGANIZAÇÃO</p>
      <nav className="nav-list">
        <NavButton active={activeView === "notes"} icon={StickyNote} label="Notas e tarefas" onClick={() => goTo("notes")} badge={openTasks || undefined} />
      </nav>
      <div className="sidebar-footer"><span className="online-dot" />Espaço sincronizado</div>
    </aside>
    {sidebarOpen && <button className="backdrop" aria-label="Fechar menu" onClick={() => setSidebarOpen(false)} />}

    <section className="hub-main">
      <header className="hub-header">
        <button className="icon-button menu-button" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu"><PanelLeft size={19} /></button>
        <div><p className="header-kicker">{current?.eyebrow ?? (activeView === "notes" ? "ORGANIZAÇÃO PESSOAL" : "CENTRAL DE COMANDO")}</p><h1>{current?.label ?? (activeView === "notes" ? "Notas e tarefas" : "Visão geral")}</h1></div>
        <div className="header-actions"><span className="synced"><span className="online-dot" />Salvo na nuvem</span><button className="icon-button" onClick={() => void supabase.auth.signOut()} title="Sair" aria-label="Sair"><LogOut size={18} /></button></div>
      </header>

      {activeView === "overview" && <Overview notes={notes} tasks={tasks} openTasks={openTasks} onOpen={goTo} />}
      {current && <WorkspaceView
        workspace={current}
        refreshKey={refreshKey}
        onRefresh={() => setRefreshKey((key) => key + 1)}
        noteText={noteText}
        onNoteText={setNoteText}
        taskText={taskText}
        onTaskText={setTaskText}
        onAddNote={addNote}
        onAddTask={addTask}
        notes={scopedNotes}
        tasks={scopedTasks}
        onToggleTask={toggleTask}
      />}
      {activeView === "notes" && <NotesView
        noteText={noteText}
        onNoteText={setNoteText}
        taskText={taskText}
        onTaskText={setTaskText}
        project={project}
        onProject={setProject}
        notes={notes}
        tasks={tasks}
        onAddNote={addNote}
        onAddTask={addTask}
        onToggleTask={toggleTask}
      />}
    </section>
  </main>;
}

function NavButton({ active, icon: Icon, label, onClick, badge }: { active: boolean; icon: typeof Compass; label: string; onClick: () => void; badge?: number }) {
  return <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}><Icon size={18} /><span>{label}</span>{badge ? <small>{badge}</small> : null}</button>;
}

function Overview({ notes, tasks, openTasks, onOpen }: { notes: Note[]; tasks: Task[]; openTasks: number; onOpen: (view: View) => void }) {
  const recentNotes = notes.slice(0, 3);
  return <div className="overview-page">
    <section className="overview-hero"><p><Sparkles size={15} /> TUDO NO MESMO LUGAR</p><h2>Trabalhe, estude e acompanhe seus sistemas sem ficar trocando de projeto.</h2><span>Escolha uma aba. O sistema abre aqui dentro, com seu bloco de notas sempre por perto.</span></section>
    <section className="workspace-cards">
      {(Object.keys(workspaces) as Array<keyof typeof workspaces>).map((key) => {
        const item = workspaces[key]; const Icon = item.icon;
        return <button className={`workspace-card ${item.accent}`} key={key} onClick={() => onOpen(key)}><span className="workspace-icon"><Icon size={22} /></span><div><p>{item.eyebrow}</p><h3>{item.label}</h3><span>{item.description}</span></div><ChevronRight size={19} /></button>;
      })}
    </section>
    <section className="overview-bottom">
      <article className="overview-panel"><div className="panel-heading"><div><p>PRÓXIMOS PASSOS</p><h3>{openTasks ? `${openTasks} tarefa${openTasks > 1 ? "s" : ""} em aberto` : "Tudo em dia"}</h3></div><ClipboardList size={19} /></div><div className="mini-list">{tasks.filter((task) => !task.completed).slice(0, 4).map((task) => <div key={task.id}><Circle size={15} /><span>{task.title}</span><small>{projectLabels[(task.project_slug ?? "geral") as ProjectKey]}</small></div>)}{!tasks.filter((task) => !task.completed).length && <span className="empty-state">Adicione tarefas no seu bloco de organização.</span>}</div></article>
      <article className="overview-panel"><div className="panel-heading"><div><p>IDEIAS RECENTES</p><h3>Seu bloco de notas</h3></div><StickyNote size={19} /></div><div className="mini-notes">{recentNotes.map((note) => <div key={note.id}><span>{note.content}</span><small>{projectLabels[(note.project_slug ?? "geral") as ProjectKey]}</small></div>)}{!recentNotes.length && <span className="empty-state">As ideias que você salvar aparecem aqui.</span>}</div></article>
    </section>
  </div>;
}

function WorkspaceView({ workspace, refreshKey, onRefresh, noteText, onNoteText, taskText, onTaskText, onAddNote, onAddTask, notes, tasks, onToggleTask }: {
  workspace: (typeof workspaces)[keyof typeof workspaces]; refreshKey: number; onRefresh: () => void; noteText: string; onNoteText: (value: string) => void; taskText: string; onTaskText: (value: string) => void; onAddNote: () => void; onAddTask: () => void; notes: Note[]; tasks: Task[]; onToggleTask: (task: Task) => void;
}) {
  const Icon = workspace.icon;
  if (!workspace.url) return <section className="condor-page"><div className="condor-glow" /><span className="condor-icon"><Icon size={28} /></span><p className="header-kicker">{workspace.eyebrow}</p><h2>Condor fica aqui como centro de comando.</h2><p>Por segurança, ele continua executando diretamente no seu PC: é assim que ele consegue usar seus arquivos, sua voz e suas automações locais. Use esta aba para acompanhar ações, registrar comandos e organizar melhorias dele.</p><div className="condor-grid"><article><h3>Local e protegido</h3><p>O Condor não precisa ir para a internet para operar o seu computador.</p></article><article><h3>Próximo passo</h3><p>Na próxima evolução podemos conectar um painel do Condor ao Hub sem expor acesso ao seu PC.</p></article></div></section>;

  return <div className="workspace-page">
    <section className="workspace-intro"><div className={`intro-icon ${workspace.accent}`}><Icon size={20} /></div><div><p>{workspace.eyebrow}</p><h2>{workspace.description}</h2></div><button className="secondary-button" onClick={onRefresh}><RefreshCw size={16} /> Atualizar</button></section>
    <section className="workspace-layout">
      <article className="app-frame-card"><div className="frame-bar"><span><i /> Aberto dentro do ARTX Hub</span><a href={workspace.url} target="_blank" rel="noreferrer" title="Abrir em outra aba"><ExternalLink size={16} /></a></div><iframe key={refreshKey} src={workspace.url} title={workspace.label} allow="clipboard-write; autoplay; fullscreen" /></article>
      <aside className="workspace-side"><CaptureCard noteText={noteText} onNoteText={onNoteText} onAddNote={onAddNote} projectLabel={workspace.label} /><TaskCard taskText={taskText} onTaskText={onTaskText} onAddTask={onAddTask} tasks={tasks} onToggleTask={onToggleTask} /><RecentNotes notes={notes} /></aside>
    </section>
  </div>;
}

function CaptureCard({ noteText, onNoteText, onAddNote, projectLabel }: { noteText: string; onNoteText: (value: string) => void; onAddNote: () => void; projectLabel: string }) {
  return <article className="side-card capture-card"><div className="side-card-heading"><StickyNote size={18} /><div><h3>Anotar enquanto usa</h3><p>Vai para {projectLabel}.</p></div></div><textarea value={noteText} onChange={(event) => onNoteText(event.target.value)} placeholder="O que você quer melhorar ou lembrar?" /><button className="primary-button" onClick={onAddNote}><Send size={15} /> Salvar nota</button></article>;
}

function TaskCard({ taskText, onTaskText, onAddTask, tasks, onToggleTask }: { taskText: string; onTaskText: (value: string) => void; onAddTask: () => void; tasks: Task[]; onToggleTask: (task: Task) => void }) {
  return <article className="side-card"><div className="side-card-heading"><ClipboardList size={18} /><div><h3>Próximos passos</h3><p>{tasks.filter((task) => !task.completed).length || "Nenhuma"} tarefa aberta</p></div></div><div className="quick-add"><input value={taskText} onChange={(event) => onTaskText(event.target.value)} onKeyDown={(event) => event.key === "Enter" && onAddTask()} placeholder="Adicionar tarefa" /><button onClick={onAddTask} aria-label="Adicionar tarefa"><Plus size={17} /></button></div><div className="compact-tasks">{tasks.slice(0, 5).map((task) => <button key={task.id} className={task.completed ? "done" : ""} onClick={() => onToggleTask(task)}><span>{task.completed ? <Check size={13} /> : <Circle size={14} />}</span>{task.title}</button>)}{!tasks.length && <span className="empty-state">Deixe claro o seu próximo passo.</span>}</div></article>;
}

function RecentNotes({ notes }: { notes: Note[] }) { return <article className="side-card recent-card"><div className="side-card-heading"><FileText size={18} /><div><h3>Notas salvas</h3><p>Referências deste sistema.</p></div></div>{notes.slice(0, 3).map((note) => <p className="recent-note" key={note.id}>{note.content}</p>)}{!notes.length && <span className="empty-state">Suas observações ficam aqui.</span>}</article>; }

function NotesView({ noteText, onNoteText, taskText, onTaskText, project, onProject, notes, tasks, onAddNote, onAddTask, onToggleTask }: {
  noteText: string; onNoteText: (value: string) => void; taskText: string; onTaskText: (value: string) => void; project: ProjectKey; onProject: (project: ProjectKey) => void; notes: Note[]; tasks: Task[]; onAddNote: () => void; onAddTask: () => void; onToggleTask: (task: Task) => void;
}) {
  return <section className="notes-page"><div className="notes-create"><article className="create-panel"><p className="header-kicker">CAPTURAR IDEIA</p><h2>Tire da cabeça e deixe salvo.</h2><textarea value={noteText} onChange={(event) => onNoteText(event.target.value)} placeholder="Escreva uma ideia, uma melhoria ou uma decisão..." /><div><ProjectPicker value={project} onChange={onProject} /><button className="primary-button" onClick={onAddNote}><Plus size={16} /> Salvar nota</button></div></article><article className="create-panel"><p className="header-kicker">PLANEJAR</p><h2>O que vem agora?</h2><div className="task-composer"><input value={taskText} onChange={(event) => onTaskText(event.target.value)} onKeyDown={(event) => event.key === "Enter" && onAddTask()} placeholder="Adicionar uma tarefa" /><button className="primary-button" onClick={onAddTask}><Plus size={16} /> Adicionar</button></div><ProjectPicker value={project} onChange={onProject} /><div className="notes-task-list">{tasks.map((task) => <button key={task.id} className={task.completed ? "done" : ""} onClick={() => onToggleTask(task)}><span>{task.completed ? <Check size={14} /> : <Circle size={15} />}</span><span>{task.title}</span><small>{projectLabels[(task.project_slug ?? "geral") as ProjectKey]}</small></button>)}{!tasks.length && <span className="empty-state">Suas tarefas aparecem aqui.</span>}</div></article></div><section className="notes-section"><div><p className="header-kicker">BLOCO DE NOTAS</p><h2>Todas as suas ideias</h2></div><div className="notes-grid">{notes.map((note) => <article key={note.id}><p>{note.content}</p><small>{projectLabels[(note.project_slug ?? "geral") as ProjectKey]}</small></article>)}{!notes.length && <span className="empty-state">Comece registrando a primeira ideia.</span>}</div></section></section>;
}

function ProjectPicker({ value, onChange }: { value: ProjectKey; onChange: (value: ProjectKey) => void }) { return <select value={value} onChange={(event) => onChange(event.target.value as ProjectKey)}>{(Object.keys(projectLabels) as ProjectKey[]).map((item) => <option key={item} value={item}>{projectLabels[item]}</option>)}</select>; }

function Login({ email, password, message, onEmail, onPassword, onSubmit }: { email: string; password: string; message: string; onEmail: (value: string) => void; onPassword: (value: string) => void; onSubmit: (event: React.FormEvent) => void }) { return <main className="login"><form onSubmit={onSubmit}><p className="eyebrow">ESPAÇO PRIVADO</p><h1>ARTX Hub</h1><p>Entre para acessar seus projetos e suas anotações.</p><label>E-mail<input type="email" value={email} onChange={(event) => onEmail(event.target.value)} required /></label><label>Senha<input type="password" value={password} onChange={(event) => onPassword(event.target.value)} required /></label>{message && <span className="message">{message}</span>}<button className="primary" type="submit">Entrar</button><small>O acesso é só seu.</small></form></main>; }
function ResetPassword({ password, message, onPassword, onSubmit }: { password: string; message: string; onPassword: (value: string) => void; onSubmit: (event: React.FormEvent) => void }) { return <main className="login"><form onSubmit={onSubmit}><p className="eyebrow">ACESSO RECUPERADO</p><h1>Crie sua senha</h1><p>Defina a nova senha para concluir o acesso ao seu ARTX Hub.</p><label>Nova senha<input type="password" value={password} onChange={(event) => onPassword(event.target.value)} minLength={8} required autoFocus /></label>{message && <span className="message">{message}</span>}<button className="primary" type="submit">Salvar nova senha</button></form></main>; }
function SetupScreen() { return <main className="login"><div><p className="eyebrow">CONFIGURAÇÃO NECESSÁRIA</p><h1>Conecte o Hub</h1><p>Copie <code>.env.example</code> para <code>.env.local</code> e adicione as chaves do Supabase. O guia completo está no README.</p></div></main>; }
