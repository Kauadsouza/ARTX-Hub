"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardList,
  Cloud,
  Command,
  Compass,
  ExternalLink,
  FilePenLine,
  FileText,
  GraduationCap,
  Keyboard,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  MonitorCog,
  PanelLeft,
  PanelLeftClose,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Smartphone,
  Sparkles,
  StickyNote,
  Video,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Note = {
  id: string;
  content: string;
  project_slug: string | null;
  created_at: string;
};

type Task = {
  id: string;
  title: string;
  project_slug: string | null;
  completed: boolean;
  created_at?: string;
};

type View = "overview" | "site" | "videos" | "sat" | "condor" | "notes" | "tasks";
type ProjectKey = "site" | "videos" | "sat" | "condor" | "geral";
type ComposerTarget = "note" | "task" | null;

type Workspace = {
  label: string;
  eyebrow: string;
  description: string;
  url?: string;
  project: Exclude<ProjectKey, "geral">;
  icon: LucideIcon;
  accent: "sky" | "violet" | "amber" | "mint";
  status: string;
  statusTone: "blue" | "violet" | "amber" | "mint";
};

type CommandItem = {
  id: string;
  group: string;
  label: string;
  shortcut?: string;
  icon: LucideIcon;
  run: () => void;
};

const workspaces: Record<Exclude<View, "overview" | "notes" | "tasks">, Workspace> = {
  site: {
    label: "Meu site",
    eyebrow: "PRESENÇA DIGITAL",
    description: "Veja a versão ao vivo, compare melhorias e registre decisões enquanto navega.",
    url: "https://kauaartx.vercel.app",
    project: "site",
    icon: Compass,
    accent: "sky",
    status: "Web",
    statusTone: "blue",
  },
  videos: {
    label: "Sistema de Vídeos",
    eyebrow: "PRODUÇÃO DE CONTEÚDO",
    description: "Use ideias, roteiros e o fluxo de produção sem sair da sua central.",
    url: "https://sistema-videos.vercel.app",
    project: "videos",
    icon: Video,
    accent: "violet",
    status: "Integrado",
    statusTone: "violet",
  },
  sat: {
    label: "SAT & Inglês",
    eyebrow: "ÁREA DE ESTUDOS",
    description: "Entre nos simulados e mantenha sua rotina de estudo no mesmo lugar.",
    url: "https://sat-simulado.vercel.app",
    project: "sat",
    icon: GraduationCap,
    accent: "amber",
    status: "Web",
    statusTone: "amber",
  },
  condor: {
    label: "Condor",
    eyebrow: "SISTEMA LOCAL",
    description: "Seu assistente de PC continua protegido e organizado a partir do Hub.",
    project: "condor",
    icon: MonitorCog,
    accent: "mint",
    status: "Local",
    statusTone: "mint",
  },
};

const projectLabels: Record<ProjectKey, string> = {
  geral: "Geral",
  site: "Meu site",
  videos: "Sistema de Vídeos",
  sat: "SAT & Inglês",
  condor: "Condor",
};

const pageMeta: Record<View, { eyebrow: string; title: string }> = {
  overview: { eyebrow: "CENTRAL DE COMANDO", title: "Visão geral" },
  site: { eyebrow: workspaces.site.eyebrow, title: workspaces.site.label },
  videos: { eyebrow: workspaces.videos.eyebrow, title: workspaces.videos.label },
  sat: { eyebrow: workspaces.sat.eyebrow, title: workspaces.sat.label },
  condor: { eyebrow: workspaces.condor.eyebrow, title: workspaces.condor.label },
  notes: { eyebrow: "ORGANIZAÇÃO PESSOAL", title: "Notas" },
  tasks: { eyebrow: "ORGANIZAÇÃO PESSOAL", title: "Tarefas" },
};

const workspaceKeys = Object.keys(workspaces) as Array<keyof typeof workspaces>;

function isWorkspaceView(view: View): view is keyof typeof workspaces {
  return view === "site" || view === "videos" || view === "sat" || view === "condor";
}

function noteTitle(content: string) {
  const text = content.trim().replace(/\s+/g, " ");
  return text.length > 52 ? `${text.slice(0, 52).trimEnd()}…` : text;
}

function notePreview(content: string) {
  const text = content.trim().replace(/\s+/g, " ");
  return text.length > 116 ? `${text.slice(0, 116).trimEnd()}…` : text;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" })
    .format(new Date(date))
    .replace(".", "");
}

function fullDate() {
  const value = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function Hub() {
  const supabase = useMemo(createClient, []);
  const [sessionReady, setSessionReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [hubAccessToken, setHubAccessToken] = useState<string | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");
  const [activeView, setActiveView] = useState<View>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [noteText, setNoteText] = useState("");
  const [taskText, setTaskText] = useState("");
  const [project, setProject] = useState<ProjectKey>("geral");
  const [composerTarget, setComposerTarget] = useState<ComposerTarget>(null);

  useEffect(() => {
    if (!supabase) {
      setSessionReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
      setHubAccessToken(data.session?.access_token ?? null);
      setSessionReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setSignedIn(Boolean(session));
      setHubAccessToken(session?.access_token ?? null);
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    const savedState = window.localStorage.getItem("artx-sidebar-collapsed");
    setSidebarCollapsed(savedState === "true");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("artx-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!supabase || !signedIn) return;
    void loadWorkspace();
    // Supabase is the single source of truth between computer and phone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, supabase]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!composerTarget) return;
    const timer = window.setTimeout(() => {
      document.getElementById(composerTarget === "note" ? "note-composer" : "task-composer")?.focus();
      setComposerTarget(null);
    }, 40);
    return () => window.clearTimeout(timer);
  }, [activeView, composerTarget]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setActiveView("notes");
        setProject("geral");
        setComposerTarget("note");
      }
      if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        setActiveView("tasks");
        setProject("geral");
        setComposerTarget("task");
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  async function loadWorkspace() {
    if (!supabase) return;
    const [noteResult, taskResult] = await Promise.all([
      supabase.from("hub_notes").select("*").order("created_at", { ascending: false }).limit(48),
      supabase.from("hub_tasks").select("*").order("created_at", { ascending: false }).limit(48),
    ]);
    setNotes((noteResult.data as Note[]) ?? []);
    setTasks((taskResult.data as Task[]) ?? []);
  }

  function notify(text: string) {
    setToast(text);
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
    if (newPassword.length < 8) {
      setMessage("Use pelo menos 8 caracteres na nova senha.");
      return;
    }
    setMessage("Salvando nova senha...");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setMessage("Não foi possível atualizar a senha. Abra o link do e-mail novamente.");
      return;
    }
    setMessage("");
    setNewPassword("");
    setRecoveryMode(false);
  }

  async function addNote() {
    if (!supabase || !noteText.trim()) return;
    const content = noteText.trim();
    const { data, error } = await supabase
      .from("hub_notes")
      .insert({ content, project_slug: project === "geral" ? null : project })
      .select()
      .single();
    if (error || !data) {
      notify("Não foi possível salvar a nota.");
      return;
    }
    setNotes((current) => [data as Note, ...current]);
    setNoteText("");
    notify("Nota salva na nuvem");
  }

  async function updateNote(note: Note, content: string) {
    if (!supabase || !content.trim() || content.trim() === note.content) return;
    const nextContent = content.trim();
    setNotes((current) => current.map((item) => item.id === note.id ? { ...item, content: nextContent } : item));
    const { error } = await supabase.from("hub_notes").update({ content: nextContent }).eq("id", note.id);
    if (error) {
      setNotes((current) => current.map((item) => item.id === note.id ? note : item));
      notify("Não foi possível atualizar a nota.");
      return;
    }
    notify("Alteração salva");
  }

  async function addTask() {
    if (!supabase || !taskText.trim()) return;
    const title = taskText.trim();
    const { data, error } = await supabase
      .from("hub_tasks")
      .insert({ title, project_slug: project === "geral" ? null : project })
      .select()
      .single();
    if (error || !data) {
      notify("Não foi possível criar a tarefa.");
      return;
    }
    setTasks((current) => [data as Task, ...current]);
    setTaskText("");
    notify("Tarefa criada");
  }

  async function toggleTask(task: Task) {
    if (!supabase) return;
    const completed = !task.completed;
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed } : item));
    const { error } = await supabase.from("hub_tasks").update({ completed }).eq("id", task.id);
    if (error) {
      setTasks((current) => current.map((item) => item.id === task.id ? task : item));
      notify("Não foi possível alterar a tarefa.");
      return;
    }
    notify(completed ? "Tarefa concluída" : "Tarefa reaberta");
  }

  function goTo(view: View) {
    setActiveView(view);
    setSidebarOpen(false);
    if (isWorkspaceView(view)) setProject(workspaces[view].project);
  }

  function startCreate(target: Exclude<ComposerTarget, null>) {
    setCommandOpen(false);
    setCommandQuery("");
    setProject("geral");
    setActiveView(target === "note" ? "notes" : "tasks");
    setComposerTarget(target);
  }

  if (!sessionReady) {
    return <main className="loading"><span className="loading-mark">A</span><p>Abrindo sua central...</p></main>;
  }
  if (!supabase) return <SetupScreen />;
  if (recoveryMode) return <ResetPassword password={newPassword} message={message} onPassword={setNewPassword} onSubmit={resetPassword} />;
  if (!signedIn) return <Login email={email} password={password} message={message} onEmail={setEmail} onPassword={setPassword} onSubmit={login} />;

  const openTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);
  const activeWorkspace = isWorkspaceView(activeView) ? workspaces[activeView] : null;
  const scopedNotes = activeWorkspace ? notes.filter((note) => note.project_slug === activeWorkspace.project) : notes;
  const scopedTasks = activeWorkspace ? tasks.filter((task) => task.project_slug === activeWorkspace.project) : tasks;
  const page = pageMeta[activeView];

  const commands: CommandItem[] = [
    { id: "overview", group: "Navegar", label: "Abrir visão geral", icon: LayoutDashboard, run: () => goTo("overview") },
    { id: "site", group: "Sistemas", label: "Abrir Meu site", icon: Compass, run: () => goTo("site") },
    { id: "videos", group: "Sistemas", label: "Abrir Sistema de Vídeos", icon: Video, run: () => goTo("videos") },
    { id: "sat", group: "Sistemas", label: "Abrir SAT & Inglês", icon: GraduationCap, run: () => goTo("sat") },
    { id: "condor", group: "Sistemas", label: "Abrir Condor", icon: MonitorCog, run: () => goTo("condor") },
    { id: "notes", group: "Organização", label: "Ver todas as notas", icon: StickyNote, run: () => goTo("notes") },
    { id: "tasks", group: "Organização", label: "Ver tarefas", icon: ClipboardList, run: () => goTo("tasks") },
    { id: "new-note", group: "Criar", label: "Nova nota", shortcut: "N", icon: FilePenLine, run: () => startCreate("note") },
    { id: "new-task", group: "Criar", label: "Nova tarefa", shortcut: "T", icon: Plus, run: () => startCreate("task") },
  ];

  return <main className={`hub-shell ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}>
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="sidebar-top">
        <button className="brand" onClick={() => goTo("overview")} aria-label="Abrir visão geral do ARTX Hub">
          <span className="brand-mark">A</span>
          <span className="brand-copy"><strong>ARTX Hub</strong><small>Central pessoal</small></span>
        </button>
        <button className="icon-button sidebar-collapse" onClick={() => setSidebarCollapsed((current) => !current)} aria-label={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}>
          {sidebarCollapsed ? <PanelLeft size={17} /> : <PanelLeftClose size={17} />}
        </button>
        <button className="icon-button close-menu" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu"><X size={18} /></button>
      </div>

      <SidebarGroup label="Central">
        <NavButton active={activeView === "overview"} icon={LayoutDashboard} label="Visão geral" onClick={() => goTo("overview")} />
      </SidebarGroup>
      <SidebarGroup label="Trabalho">
        <NavButton active={activeView === "site"} icon={Compass} label="Meu site" onClick={() => goTo("site")} />
        <NavButton active={activeView === "videos"} icon={Video} label="Sistema de vídeos" onClick={() => goTo("videos")} />
      </SidebarGroup>
      <SidebarGroup label="Estudos">
        <NavButton active={activeView === "sat"} icon={GraduationCap} label="SAT & Inglês" onClick={() => goTo("sat")} />
      </SidebarGroup>
      <SidebarGroup label="Sistemas">
        <NavButton active={activeView === "condor"} icon={MonitorCog} label="Condor" onClick={() => goTo("condor")} />
      </SidebarGroup>
      <SidebarGroup label="Organização" className="organization-group">
        <NavButton active={activeView === "notes"} icon={StickyNote} label="Notas" onClick={() => goTo("notes")} />
        <NavButton active={activeView === "tasks"} icon={ClipboardList} label="Tarefas" onClick={() => goTo("tasks")} badge={openTasks.length || undefined} />
      </SidebarGroup>

      <div className="sidebar-bottom">
        <button className="sidebar-profile" onClick={() => setCommandOpen(true)} title="Abrir comandos">
          <span>K</span><div><strong>Kauã</strong><small>Espaço privado</small></div>
        </button>
        <button className="icon-button settings-button" onClick={() => setCommandOpen(true)} aria-label="Abrir comandos"><Settings2 size={16} /></button>
      </div>
    </aside>
    {sidebarOpen && <button className="backdrop" aria-label="Fechar menu" onClick={() => setSidebarOpen(false)} />}

    <section className="hub-main">
      <header className="hub-header">
        <button className="icon-button menu-button" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu"><Menu size={19} /></button>
        <div className="breadcrumb"><span>ARTX</span><ChevronRight size={13} /><strong>{page.title}</strong></div>
        <div className="header-actions">
          <button className="command-trigger" onClick={() => setCommandOpen(true)}><Search size={16} /><span>Buscar</span><kbd>⌘ K</kbd></button>
          <button className="quick-create" onClick={() => { setCommandQuery(""); setCommandOpen(true); }}><Plus size={16} /><span>Criar</span></button>
          <span className="synced" title="Notas e tarefas sincronizadas"><Cloud size={15} /><span>Salvo</span></span>
          <button className="icon-button" onClick={() => void supabase.auth.signOut()} title="Sair" aria-label="Sair"><LogOut size={17} /></button>
        </div>
      </header>

      {activeView === "overview" && <Overview
        notes={notes}
        tasks={tasks}
        onOpen={goTo}
        onNewNote={() => startCreate("note")}
        onNewTask={() => startCreate("task")}
      />}
      {activeWorkspace && <WorkspaceView
        workspace={activeWorkspace}
        hubAccessToken={hubAccessToken}
        refreshKey={refreshKey}
        previewMode={previewMode}
        onPreviewMode={setPreviewMode}
        onRefresh={() => { setRefreshKey((key) => key + 1); notify("Preview atualizado"); }}
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
      {(activeView === "notes" || activeView === "tasks") && <NotesTasksView
        focus={activeView}
        noteText={noteText}
        onNoteText={setNoteText}
        taskText={taskText}
        onTaskText={setTaskText}
        project={project}
        onProject={setProject}
        notes={notes}
        openTasks={openTasks}
        completedTasks={completedTasks}
        onAddNote={addNote}
        onUpdateNote={updateNote}
        onAddTask={addTask}
        onToggleTask={toggleTask}
      />}
    </section>

    <CommandPalette
      open={commandOpen}
      query={commandQuery}
      commands={commands}
      onQuery={setCommandQuery}
      onClose={() => { setCommandOpen(false); setCommandQuery(""); }}
    />
    {toast && <div className="toast" role="status"><CheckCircle2 size={16} />{toast}</div>}
  </main>;
}

function SidebarGroup({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`sidebar-group ${className}`}><p className="side-label">{label}</p><nav className="nav-list">{children}</nav></div>;
}

function NavButton({ active, icon: Icon, label, onClick, badge }: { active: boolean; icon: LucideIcon; label: string; onClick: () => void; badge?: number }) {
  return <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick} title={label}>
    <Icon size={17} strokeWidth={1.8} /><span className="nav-text">{label}</span>{badge ? <small>{badge}</small> : null}
  </button>;
}

function Overview({ notes, tasks, onOpen, onNewNote, onNewTask }: {
  notes: Note[];
  tasks: Task[];
  onOpen: (view: View) => void;
  onNewNote: () => void;
  onNewTask: () => void;
}) {
  const openTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);
  const focusTask = openTasks[0];
  const progress = tasks.length ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  return <div className="overview-page page-enter">
    <section className="dashboard-intro">
      <div><p className="eyebrow"><Sparkles size={13} /> CENTRAL DE COMANDO</p><h2>{greeting()}, Kauã.</h2><p className="date-line">{fullDate()}</p></div>
      <div className="today-stats" aria-label="Resumo de hoje">
        <Metric value={openTasks.length} label="tarefas abertas" />
        <Metric value={notes.length} label="notas salvas" />
        <Metric value={workspaceKeys.length} label="sistemas" />
      </div>
    </section>

    <section className="focus-grid">
      <article className="focus-card">
        <div className="panel-kicker"><span>FOCO ATUAL</span><Zap size={15} /></div>
        <h3>{focusTask ? focusTask.title : "Defina o próximo passo"}</h3>
        <p>{focusTask ? `${projectLabels[(focusTask.project_slug ?? "geral") as ProjectKey]} · tarefa em aberto` : "Quando criar tarefas, seu próximo passo aparece aqui."}</p>
        <div className="progress-row"><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><strong>{progress}%</strong></div>
      </article>
      <article className="quick-actions-card">
        <div className="panel-kicker"><span>AÇÕES RÁPIDAS</span><Keyboard size={15} /></div>
        <div className="quick-actions">
          <button onClick={onNewTask}><Plus size={15} /> Nova tarefa <kbd>T</kbd></button>
          <button onClick={onNewNote}><FilePenLine size={15} /> Nova nota <kbd>N</kbd></button>
          <button onClick={() => onOpen("videos")}><Video size={15} /> Abrir vídeos <ArrowUpRight size={14} /></button>
        </div>
      </article>
    </section>

    <section className="section-heading systems-heading"><div><p className="eyebrow">SISTEMAS</p><h2>Seu espaço de trabalho</h2></div><span>4 ambientes conectados</span></section>
    <section className="systems-grid">
      {workspaceKeys.map((key) => <SystemCard key={key} workspace={workspaces[key]} onOpen={() => onOpen(key)} />)}
    </section>

    <section className="dashboard-lower">
      <article className="data-panel my-day-panel">
        <PanelHeader eyebrow="MEU DIA" title={openTasks.length ? `${openTasks.length} em aberto` : "Tudo limpo por aqui"} icon={ClipboardList} action="Ver tarefas" onAction={() => onOpen("tasks")} />
        <div className="task-list">
          {openTasks.slice(0, 4).map((task) => <div key={task.id}><Circle size={15} /><span>{task.title}</span><small>{projectLabels[(task.project_slug ?? "geral") as ProjectKey]}</small></div>)}
          {!openTasks.length && <EmptyState label="Nenhuma tarefa pendente agora." compact />}
        </div>
      </article>
      <article className="data-panel recent-notes-panel">
        <PanelHeader eyebrow="NOTAS RECENTES" title={notes.length ? "Últimas capturas" : "Seu bloco está vazio"} icon={StickyNote} action="Ver notas" onAction={() => onOpen("notes")} />
        <div className="note-list-mini">
          {notes.slice(0, 4).map((note) => <div key={note.id}><div><strong>{noteTitle(note.content)}</strong><span>{projectLabels[(note.project_slug ?? "geral") as ProjectKey]}</span></div><time>{formatDate(note.created_at)}</time></div>)}
          {!notes.length && <EmptyState label="Salve uma ideia para ela aparecer aqui." compact />}
        </div>
      </article>
    </section>
  </div>;
}

function Metric({ value, label }: { value: number; label: string }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function SystemCard({ workspace, onOpen }: { workspace: Workspace; onOpen: () => void }) {
  const Icon = workspace.icon;
  return <button className={`system-card ${workspace.accent}`} onClick={onOpen}>
    <div className="system-card-top"><span className="system-icon"><Icon size={19} /></span><StatusPill tone={workspace.statusTone}>{workspace.status}</StatusPill></div>
    <div><p>{workspace.eyebrow}</p><h3>{workspace.label}</h3><span className="system-description">{workspace.description}</span></div>
    <span className="system-open">Abrir <ArrowUpRight size={15} /></span>
  </button>;
}

function StatusPill({ tone, children }: { tone: "blue" | "violet" | "amber" | "mint"; children: React.ReactNode }) {
  return <span className={`status-pill ${tone}`}><i />{children}</span>;
}

function PanelHeader({ eyebrow, title, icon: Icon, action, onAction }: { eyebrow: string; title: string; icon: LucideIcon; action?: string; onAction?: () => void }) {
  return <div className="panel-header"><div><p>{eyebrow}</p><h3>{title}</h3></div><div>{onAction && action ? <button onClick={onAction}>{action}<ChevronRight size={14} /></button> : <Icon size={18} />}</div></div>;
}

function EmptyState({ label, compact = false }: { label: string; compact?: boolean }) {
  return <div className={`empty-state ${compact ? "compact" : ""}`}><CheckCircle2 size={16} /><span>{label}</span></div>;
}

function WorkspaceView({ workspace, hubAccessToken, refreshKey, previewMode, onPreviewMode, onRefresh, noteText, onNoteText, taskText, onTaskText, onAddNote, onAddTask, notes, tasks, onToggleTask }: {
  workspace: Workspace;
  hubAccessToken: string | null;
  refreshKey: number;
  previewMode: "desktop" | "mobile";
  onPreviewMode: (mode: "desktop" | "mobile") => void;
  onRefresh: () => void;
  noteText: string;
  onNoteText: (value: string) => void;
  taskText: string;
  onTaskText: (value: string) => void;
  onAddNote: () => void;
  onAddTask: () => void;
  notes: Note[];
  tasks: Task[];
  onToggleTask: (task: Task) => void;
}) {
  const Icon = workspace.icon;
  if (!workspace.url) {
    return <section className="condor-page page-enter">
      <div className="condor-spotlight" />
      <div className="condor-header"><span className="condor-icon"><Icon size={25} /></span><StatusPill tone="mint">Local no PC</StatusPill></div>
      <p className="eyebrow">{workspace.eyebrow}</p><h2>O Condor opera perto de você.</h2>
      <p className="condor-copy">Ele continua executando diretamente no seu computador para manter arquivos, voz e automações protegidos. O Hub vira o lugar para acompanhar melhorias, registrar comandos e organizar a próxima evolução.</p>
      <div className="condor-grid">
        <article><Monitor size={18} /><h3>Ambiente local</h3><p>O acesso ao PC não é exposto à internet.</p></article>
        <article><ClipboardList size={18} /><h3>Próximo passo</h3><p>Registre no Hub o que você quer automatizar ou melhorar.</p></article>
        <article><Cloud size={18} /><h3>Centralizado</h3><p>As suas notas do Condor ficam sincronizadas aqui.</p></article>
      </div>
    </section>;
  }

  return <div className="workspace-page page-enter">
    <section className="workspace-hero">
      <div className={`workspace-hero-icon ${workspace.accent}`}><Icon size={21} /></div>
      <div><p className="eyebrow">{workspace.eyebrow}</p><h2>{workspace.label}</h2><span>{workspace.description}</span></div>
      <div className="workspace-hero-actions"><StatusPill tone={workspace.statusTone}>{workspace.status}</StatusPill><button className="secondary-button" onClick={onRefresh}><RefreshCw size={15} /> Atualizar</button></div>
    </section>
    <section className="workspace-layout">
      <article className={`app-frame-card ${previewMode === "mobile" ? "mobile-preview" : ""}`}>
        <div className="frame-toolbar"><div className="frame-label"><span><i /><i /><i /></span><strong>{workspace.label}</strong><small>Dentro do ARTX Hub</small></div><div className="frame-controls">
          {workspace.project === "site" && <div className="preview-toggle"><button className={previewMode === "desktop" ? "active" : ""} onClick={() => onPreviewMode("desktop")} aria-label="Visualizar desktop"><Monitor size={14} /></button><button className={previewMode === "mobile" ? "active" : ""} onClick={() => onPreviewMode("mobile")} aria-label="Visualizar celular"><Smartphone size={14} /></button></div>}
          <a href={workspace.url} target="_blank" rel="noreferrer" title="Abrir em outra aba"><ExternalLink size={16} /></a>
        </div></div>
        <div className="frame-stage"><EmbeddedWorkspaceFrame workspace={workspace} accessToken={hubAccessToken} refreshKey={refreshKey} /></div>
      </article>
      <aside className="workspace-side">
        <CaptureCard noteText={noteText} onNoteText={onNoteText} onAddNote={onAddNote} projectLabel={workspace.label} />
        <TaskCard taskText={taskText} onTaskText={onTaskText} onAddTask={onAddTask} tasks={tasks} onToggleTask={onToggleTask} />
        <RecentNotes notes={notes} />
      </aside>
    </section>
  </div>;
}

function EmbeddedWorkspaceFrame({ workspace, accessToken, refreshKey }: { workspace: Workspace; accessToken: string | null; refreshKey: number }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const isVideoSystem = workspace.project === "videos";
  const sourceUrl = isVideoSystem ? `${workspace.url}/embed` : workspace.url!;
  const appOrigin = new URL(workspace.url!).origin;

  function sendHubSession() {
    if (!isVideoSystem || !accessToken) return;
    frameRef.current?.contentWindow?.postMessage({ type: "ARTX_HUB_AUTH", accessToken }, appOrigin);
  }

  useEffect(() => {
    if (!isVideoSystem) return;
    function onVideoReady(event: MessageEvent) {
      if (event.origin === appOrigin && event.data?.type === "ARTX_VIDEO_EMBED_READY") sendHubSession();
    }
    window.addEventListener("message", onVideoReady);
    const retry = window.setTimeout(sendHubSession, 350);
    return () => {
      window.removeEventListener("message", onVideoReady);
      window.clearTimeout(retry);
    };
  }, [accessToken, appOrigin, isVideoSystem]);

  return <iframe ref={frameRef} key={refreshKey} src={sourceUrl} title={workspace.label} onLoad={sendHubSession} allow="clipboard-write; autoplay; fullscreen" />;
}

function CaptureCard({ noteText, onNoteText, onAddNote, projectLabel }: { noteText: string; onNoteText: (value: string) => void; onAddNote: () => void; projectLabel: string }) {
  return <article className="side-card capture-card"><div className="side-card-heading"><span><StickyNote size={17} /></span><div><h3>Anotar enquanto usa</h3><p>Salvo em {projectLabel}.</p></div></div><textarea value={noteText} onChange={(event) => onNoteText(event.target.value)} placeholder="O que você quer lembrar ou melhorar?" /><button className="primary-button" onClick={onAddNote}><Send size={14} /> Salvar nota</button></article>;
}

function TaskCard({ taskText, onTaskText, onAddTask, tasks, onToggleTask }: { taskText: string; onTaskText: (value: string) => void; onAddTask: () => void; tasks: Task[]; onToggleTask: (task: Task) => void }) {
  const openTasks = tasks.filter((task) => !task.completed);
  return <article className="side-card"><div className="side-card-heading"><span><ClipboardList size={17} /></span><div><h3>Próximos passos</h3><p>{openTasks.length ? `${openTasks.length} tarefa${openTasks.length > 1 ? "s" : ""} aberta${openTasks.length > 1 ? "s" : ""}` : "Tudo em dia"}</p></div></div><div className="quick-add"><input value={taskText} onChange={(event) => onTaskText(event.target.value)} onKeyDown={(event) => event.key === "Enter" && onAddTask()} placeholder="Adicionar tarefa" /><button onClick={onAddTask} aria-label="Adicionar tarefa"><Plus size={16} /></button></div><div className="compact-tasks">{tasks.slice(0, 5).map((task) => <button key={task.id} className={task.completed ? "done" : ""} onClick={() => onToggleTask(task)}><span>{task.completed ? <Check size={13} /> : <Circle size={14} />}</span>{task.title}</button>)}{!tasks.length && <EmptyState label="Deixe claro o próximo passo." compact />}</div></article>;
}

function RecentNotes({ notes }: { notes: Note[] }) {
  return <article className="side-card recent-card"><div className="side-card-heading"><span><FileText size={17} /></span><div><h3>Notas salvas</h3><p>Referências deste sistema.</p></div></div>{notes.slice(0, 3).map((note) => <div className="recent-note" key={note.id}><strong>{noteTitle(note.content)}</strong><small>{formatDate(note.created_at)}</small></div>)}{!notes.length && <EmptyState label="Suas observações ficam aqui." compact />}</article>;
}

function NotesTasksView({ focus, noteText, onNoteText, taskText, onTaskText, project, onProject, notes, openTasks, completedTasks, onAddNote, onUpdateNote, onAddTask, onToggleTask }: {
  focus: "notes" | "tasks";
  noteText: string;
  onNoteText: (value: string) => void;
  taskText: string;
  onTaskText: (value: string) => void;
  project: ProjectKey;
  onProject: (project: ProjectKey) => void;
  notes: Note[];
  openTasks: Task[];
  completedTasks: Task[];
  onAddNote: () => void;
  onUpdateNote: (note: Note, content: string) => void;
  onAddTask: () => void;
  onToggleTask: (task: Task) => void;
}) {
  const [noteQuery, setNoteQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(notes[0]?.id ?? null);
  const selectedNote = notes.find((note) => note.id === selectedId) ?? null;
  const [draft, setDraft] = useState(selectedNote?.content ?? "");

  useEffect(() => {
    if (!selectedId && notes[0]) setSelectedId(notes[0].id);
  }, [notes, selectedId]);

  useEffect(() => {
    setDraft(selectedNote?.content ?? "");
  }, [selectedNote?.id, selectedNote?.content]);

  const filteredNotes = notes.filter((note) => note.content.toLowerCase().includes(noteQuery.toLowerCase()));

  return <section className={`organization-page page-enter focus-${focus}`}>
    <PageHeader eyebrow="ORGANIZAÇÃO" title={focus === "notes" ? "Notas e ideias" : "Tarefas"} description={focus === "notes" ? "Capture referências, decisões e melhorias do seu sistema." : "Mantenha visível apenas o que realmente vem agora."} />
    <div className="organization-top">
      <article className="create-panel note-composer-panel"><div className="panel-kicker"><span>NOVA NOTA</span><FilePenLine size={15} /></div><textarea id="note-composer" value={noteText} onChange={(event) => onNoteText(event.target.value)} placeholder="Escreva uma ideia, melhoria ou decisão..." /><div className="composer-footer"><ProjectPicker value={project} onChange={onProject} /><button className="primary-button" onClick={onAddNote}><Plus size={15} /> Salvar nota</button></div></article>
      <article className="create-panel task-composer-panel"><div className="panel-kicker"><span>NOVA TAREFA</span><ClipboardList size={15} /></div><div className="task-composer"><input id="task-composer" value={taskText} onChange={(event) => onTaskText(event.target.value)} onKeyDown={(event) => event.key === "Enter" && onAddTask()} placeholder="Qual é o próximo passo?" /><button className="primary-button" onClick={onAddTask}><Plus size={15} /> Adicionar</button></div><div className="composer-footer"><ProjectPicker value={project} onChange={onProject} /><span className="saved-state"><Cloud size={14} /> Sincronizado</span></div></article>
    </div>

    <div className="organization-grid">
      <section className="notes-library data-panel"><PanelHeader eyebrow="BLOCO DE NOTAS" title={`${notes.length} nota${notes.length === 1 ? "" : "s"}`} icon={StickyNote} /><div className="notes-search"><Search size={15} /><input value={noteQuery} onChange={(event) => setNoteQuery(event.target.value)} placeholder="Buscar nas notas" /></div><div className="notes-library-list">{filteredNotes.map((note) => <button className={note.id === selectedNote?.id ? "selected" : ""} key={note.id} onClick={() => setSelectedId(note.id)}><div><strong>{noteTitle(note.content)}</strong><span>{notePreview(note.content)}</span></div><time>{formatDate(note.created_at)}</time></button>)}{!filteredNotes.length && <EmptyState label={noteQuery ? "Nenhuma nota encontrada." : "Comece registrando a primeira ideia."} />}</div></section>
      <section className="note-editor data-panel"><PanelHeader eyebrow="EDITOR" title={selectedNote ? formatDate(selectedNote.created_at) : "Selecione uma nota"} icon={FileText} />{selectedNote ? <><textarea value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Editar nota" /><div className="editor-footer"><StatusPill tone="violet">{projectLabels[(selectedNote.project_slug ?? "geral") as ProjectKey]}</StatusPill><button className="primary-button" onClick={() => onUpdateNote(selectedNote, draft)}><Check size={15} /> Salvar alteração</button></div></> : <EmptyState label="Selecione ou crie uma nota para editar." />}</section>
      <section className="tasks-board data-panel"><PanelHeader eyebrow="TAREFAS" title={openTasks.length ? `${openTasks.length} em aberto` : "Tudo concluído"} icon={ClipboardList} /><div className="task-board-section"><p>EM ABERTO</p>{openTasks.slice(0, 8).map((task) => <TaskRow task={task} key={task.id} onToggle={onToggleTask} />)}{!openTasks.length && <EmptyState label="Nenhuma tarefa pendente." compact />}</div><div className="task-board-section completed"><p>CONCLUÍDAS</p>{completedTasks.slice(0, 4).map((task) => <TaskRow task={task} key={task.id} onToggle={onToggleTask} />)}{!completedTasks.length && <span className="empty-caption">As concluídas aparecem aqui.</span>}</div></section>
    </div>
  </section>;
}

function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><span>{description}</span></div></header>;
}

function TaskRow({ task, onToggle }: { task: Task; onToggle: (task: Task) => void }) {
  return <button className={`task-row ${task.completed ? "done" : ""}`} onClick={() => onToggle(task)}><span>{task.completed ? <Check size={13} /> : <Circle size={14} />}</span><strong>{task.title}</strong><small>{projectLabels[(task.project_slug ?? "geral") as ProjectKey]}</small></button>;
}

function ProjectPicker({ value, onChange }: { value: ProjectKey; onChange: (value: ProjectKey) => void }) {
  return <select value={value} onChange={(event) => onChange(event.target.value as ProjectKey)} aria-label="Projeto relacionado">{(Object.keys(projectLabels) as ProjectKey[]).map((item) => <option key={item} value={item}>{projectLabels[item]}</option>)}</select>;
}

function CommandPalette({ open, query, commands, onQuery, onClose }: { open: boolean; query: string; commands: CommandItem[]; onQuery: (value: string) => void; onClose: () => void }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const filtered = commands.filter((command) => `${command.group} ${command.label}`.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => setActiveIndex(0), [query, open]);
  if (!open) return null;

  function select(command: CommandItem) {
    command.run();
    onClose();
  }

  return <div className="command-overlay" role="presentation" onMouseDown={onClose}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Comandos rápidos" onMouseDown={(event) => event.stopPropagation()}><div className="command-input"><Search size={18} /><input autoFocus value={query} onChange={(event) => onQuery(event.target.value)} onKeyDown={(event) => {
    if (event.key === "Escape") onClose();
    if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((current) => Math.min(current + 1, filtered.length - 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((current) => Math.max(current - 1, 0)); }
    if (event.key === "Enter" && filtered[activeIndex]) select(filtered[activeIndex]);
  }} placeholder="Buscar páginas e ações..." /><kbd>ESC</kbd></div><div className="command-results">{filtered.map((command, index) => { const Icon = command.icon; return <button key={command.id} className={index === activeIndex ? "active" : ""} onMouseEnter={() => setActiveIndex(index)} onClick={() => select(command)}><span className="command-icon"><Icon size={16} /></span><div><small>{command.group}</small><strong>{command.label}</strong></div>{command.shortcut ? <kbd>{command.shortcut}</kbd> : <ChevronRight size={15} />}</button>; })}{!filtered.length && <EmptyState label="Nenhum comando encontrado." />}</div><footer><Command size={14} /> Use ↑ ↓ para navegar e Enter para abrir</footer></section></div>;
}

function Login({ email, password, message, onEmail, onPassword, onSubmit }: { email: string; password: string; message: string; onEmail: (value: string) => void; onPassword: (value: string) => void; onSubmit: (event: React.FormEvent) => void }) {
  return <main className="login"><div className="login-orbit" /><form onSubmit={onSubmit}><div className="login-brand"><span className="brand-mark">A</span><div><strong>ARTX Hub</strong><small>Central pessoal</small></div></div><p className="eyebrow">ESPAÇO PRIVADO</p><h1>Seu espaço para construir.</h1><p>Entre para acessar projetos, anotações e seu dia de trabalho.</p><label>E-mail<input type="email" value={email} onChange={(event) => onEmail(event.target.value)} required /></label><label>Senha<input type="password" value={password} onChange={(event) => onPassword(event.target.value)} required /></label>{message && <span className="message">{message}</span>}<button className="primary" type="submit">Entrar no Hub <ArrowUpRight size={16} /></button><small className="login-footer"><span /> Acesso particular e sincronizado</small></form></main>;
}

function ResetPassword({ password, message, onPassword, onSubmit }: { password: string; message: string; onPassword: (value: string) => void; onSubmit: (event: React.FormEvent) => void }) {
  return <main className="login"><div className="login-orbit" /><form onSubmit={onSubmit}><div className="login-brand"><span className="brand-mark">A</span><div><strong>ARTX Hub</strong><small>Central pessoal</small></div></div><p className="eyebrow">ACESSO RECUPERADO</p><h1>Defina a nova senha.</h1><p>Escolha uma senha forte para concluir o acesso ao seu espaço privado.</p><label>Nova senha<input type="password" value={password} onChange={(event) => onPassword(event.target.value)} minLength={8} required autoFocus /></label>{message && <span className="message">{message}</span>}<button className="primary" type="submit">Salvar nova senha <Check size={16} /></button></form></main>;
}

function SetupScreen() {
  return <main className="login"><div className="login-orbit" /><div className="setup-card"><span className="brand-mark">A</span><p className="eyebrow">CONFIGURAÇÃO NECESSÁRIA</p><h1>Conecte o Hub.</h1><p>Adicione a URL e a chave pública do Supabase em <code>.env.local</code>. O guia completo está no README.</p></div></main>;
}
