"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Award,
  Check,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Command,
  Compass,
  ExternalLink,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  MonitorCog,
  Maximize2,
  Minimize2,
  PanelLeft,
  PanelLeftClose,
  RefreshCw,
  Search,
  Settings2,
  Smartphone,
  Sparkles,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { certificateBucket, certificatePath, certificateReference, downloadCertificate, localCertificate, parseCertificateReference, isStoredCertificate, validateCertificate } from "@/lib/course-certificates";
import { PersonalDashboard } from "@/components/PersonalDashboard";
import { CondorWorkspace } from "@/components/CondorWorkspace";
import { CoursesResume, courseCatalog, type CourseProgress, type CourseProgressPatch, type CourseProgressStatus } from "@/components/CoursesResume";

type Task = {
  id: string;
  title: string;
  project_slug: string | null;
  completed: boolean;
  created_at?: string;
};

type View = "overview" | "site" | "videos" | "sat" | "university" | "career" | "condor";
type ProjectKey = "site" | "videos" | "sat" | "university" | "condor" | "geral";
type SystemSignal = { state: "ready" | "syncing" | "attention"; title: string; detail: string; updatedAt: string };

type LocalHubSnapshot = {
  tasks?: Array<{ id: string; titulo: string; projeto: string; status: string; criado: number }>;
};

type Workspace = {
  label: string;
  eyebrow: string;
  description: string;
  url?: string;
  logo: string;
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

const assetPath = (path: string) => `${process.env.NEXT_PUBLIC_ARTX_BASE_PATH ?? ""}${path}`;

async function localHubRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.erro || "O Condor não concluiu esta ação.");
  return payload as T;
}

const workspaces: Record<Exclude<View, "overview" | "career">, Workspace> = {
  site: {
    label: "Site KauaArtx",
    eyebrow: "PRESENÇA DIGITAL",
    description: "Veja a versão ao vivo, compare melhorias e registre decisões enquanto navega.",
    url: "https://kauaartx.vercel.app",
    logo: assetPath("/brand/site.svg"),
    project: "site",
    icon: Compass,
    accent: "sky",
    status: "Web",
    statusTone: "blue",
  },
  videos: {
    label: "KauaArtx Video Studio",
    eyebrow: "PRODUÇÃO DE CONTEÚDO",
    description: "Use ideias, roteiros e o fluxo de produção sem sair da sua central.",
    url: "https://sistema-videos.vercel.app",
    logo: assetPath("/brand/videos.svg"),
    project: "videos",
    icon: Video,
    accent: "violet",
    status: "Integrado",
    statusTone: "violet",
  },
  sat: {
    label: "SAT & English Learning",
    eyebrow: "ÁREA DE ESTUDOS",
    description: "Cursos gratuitos, conversação e seu plano de inglês, com abas SAT, ACT e TOEFL.",
    url: "https://sat-simulado.vercel.app",
    logo: assetPath("/brand/sat.svg"),
    project: "sat",
    icon: GraduationCap,
    accent: "amber",
    status: "Web",
    statusTone: "amber",
  },
  university: {
    label: "University Path",
    eyebrow: "PLANO UNIVERSITÁRIO",
    description: "Seu caminho prático para Computer Science em Oxford, com fontes oficiais e próximos passos.",
    url: "https://university-path-six.vercel.app",
    logo: assetPath("/brand/university.svg"),
    project: "university",
    icon: GraduationCap,
    accent: "mint",
    status: "Planejamento",
    statusTone: "mint",
  },
  condor: {
    label: "Condor AI",
    eyebrow: "INTELIGÊNCIA DO HUB",
    description: "Assistente independente. Os estudos e o canal funcionam sem depender dele.",
    logo: assetPath("/brand/condor.svg"),
    project: "condor",
    icon: MonitorCog,
    accent: "mint",
    status: "Separado",
    statusTone: "mint",
  },
};

const pageMeta: Record<View, { eyebrow: string; title: string }> = {
  overview: { eyebrow: "CENTRAL DE COMANDO", title: "Visão geral" },
  site: { eyebrow: workspaces.site.eyebrow, title: workspaces.site.label },
  videos: { eyebrow: workspaces.videos.eyebrow, title: workspaces.videos.label },
  sat: { eyebrow: workspaces.sat.eyebrow, title: workspaces.sat.label },
  university: { eyebrow: workspaces.university.eyebrow, title: workspaces.university.label },
  career: { eyebrow: "DESENVOLVIMENTO PESSOAL", title: "Currículo & Cursos" },
  condor: { eyebrow: workspaces.condor.eyebrow, title: workspaces.condor.label },
};



function isWorkspaceView(view: View): view is keyof typeof workspaces {
  return view === "site" || view === "videos" || view === "sat" || view === "university" || view === "condor";
}

export function Hub() {
  const supabase = useMemo(() => createClient(), []);
  const [sessionReady, setSessionReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [localMode, setLocalMode] = useState(false);
  const [hubAccessToken, setHubAccessToken] = useState<string | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loginPending, setLoginPending] = useState(false);
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [toast, setToast] = useState("");
  const [activeView, setActiveView] = useState<View>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Array<{ id: string; content: string; created_at: string }>>([]);
  const [courseProgress, setCourseProgress] = useState<CourseProgress[]>([]);
  const [savingCourseId, setSavingCourseId] = useState<string | null>(null);
  const [certificateBusyId, setCertificateBusyId] = useState<string | null>(null);
  const certificateOperation = useRef(false);
  const courseMutationPending = useRef(false);
  const [syncError, setSyncError] = useState("");
  const [syncing, setSyncing] = useState(true);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [systemSignals, setSystemSignals] = useState<Partial<Record<ProjectKey, SystemSignal>>>({});
  const sessionIdentity = useRef<string | null>(null);
  const loadVersion = useRef(0);

  const loadWorkspace = useCallback(async () => {
    if (courseMutationPending.current || certificateOperation.current) return;
    const version = ++loadVersion.current;
    const owner = sessionUserId;
    const isCurrent = () => version === loadVersion.current && owner === sessionIdentity.current;
    setSyncing(true);
    setSyncError("");
    try {
    if (localMode) {
      try { setCourseProgress(JSON.parse(window.localStorage.getItem("artx-course-progress") ?? "[]")); } catch { setCourseProgress([]); }
      await localHubRequest("/api/session", { method: "POST" });
      const snapshot = await localHubRequest<LocalHubSnapshot>("/api/hub");
      if (!isCurrent()) return;
      setTasks((snapshot.tasks ?? []).map((task) => ({
        id: task.id,
        title: task.titulo,
        project_slug: task.projeto || null,
        completed: task.status === "concluida",
        created_at: new Date(task.criado * 1000).toISOString(),
      })));
      return;
    }
    if (!supabase) return;
    const [taskResult, noteResult, courseResult] = await Promise.all([
      supabase.from("hub_tasks").select("id,title,project_slug,completed,created_at").order("created_at", { ascending: false }).limit(1000),
      supabase.from("hub_notes").select("id,content,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("hub_course_progress").select("course_id,status,progress_percent,current_step,next_step,private_note,certificate_url,completed_at,updated_at").order("updated_at", { ascending: false }),
    ]);
    if (!isCurrent()) return;
    if (taskResult.error || noteResult.error || courseResult.error) throw new Error("sync_failed");
    setTasks((taskResult.data as Task[]) ?? []);
    setNotes(noteResult.data ?? []);
    setCourseProgress((courseResult.data as CourseProgress[]) ?? []);
    } catch {
      if (isCurrent()) setSyncError("Não foi possível sincronizar. Confira a conexão e tente novamente; os dados exibidos podem estar desatualizados.");
    } finally { if (isCurrent()) setSyncing(false); }
  }, [localMode, supabase, sessionUserId]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ARTX_BASE_PATH === "/hub" && ["127.0.0.1", "localhost", "::1"].includes(window.location.hostname)) {
      setLocalMode(true);
      setSignedIn(true);
      setSessionReady(true);
      return;
    }
    if (!supabase) {
      setSessionReady(true);
      return;
    }
    const authTimeout = window.setTimeout(() => { setSessionReady(true); setMessage("A conexão demorou. Tente entrar novamente."); }, 15000);
    supabase.auth.getSession().then(({ data }) => {
      window.clearTimeout(authTimeout);
      sessionIdentity.current = data.session?.user.id ?? null;
      setSessionUserId(sessionIdentity.current);
      setSignedIn(Boolean(data.session));
      setHubAccessToken(data.session?.access_token ?? null);
      setSessionReady(true);
    }).catch(() => { window.clearTimeout(authTimeout); setSessionReady(true); setMessage("Falha de conexão. Tente novamente."); });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const nextOwner = session?.user.id ?? null;
      if (sessionIdentity.current !== nextOwner) {
        ++loadVersion.current;
        setTasks([]); setNotes([]); setCourseProgress([]); setSyncError("");
      }
      sessionIdentity.current = nextOwner;
      setSessionUserId(nextOwner);
      setSignedIn(Boolean(session));
      setHubAccessToken(session?.access_token ?? null);
      if (!session) { setTasks([]); setNotes([]); setCourseProgress([]); }
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => { window.clearTimeout(authTimeout); listener.subscription.unsubscribe(); };
  }, [supabase]);

  useEffect(() => {
    const savedState = window.localStorage.getItem("artx-sidebar-collapsed");
    setSidebarCollapsed(savedState === "true");
    try { setSystemSignals(JSON.parse(window.localStorage.getItem("artx-system-signals") ?? "{}")); } catch { setSystemSignals({}); }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("artx-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    window.localStorage.setItem("artx-system-signals", JSON.stringify(systemSignals));
  }, [systemSignals]);

  useEffect(() => {
    if (!signedIn) return;
    void loadWorkspace();
    const refresh = () => { if (document.visibilityState === "visible") void loadWorkspace(); };
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => { window.removeEventListener("online", refresh); window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, [loadWorkspace, signedIn]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  function notify(text: string) {
    setToast(text);
  }

  async function login(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || loginPending) return;
    setLoginPending(true);
    setMessage("Entrando...");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setPassword("");
      setMessage(error ? "Não foi possível entrar com essas credenciais." : "");
    } catch { setMessage("Falha de conexão. Tente novamente."); } finally {
      setLoginPending(false);
    }
  }

  async function requestPasswordReset() {
    if (!supabase || recoveryPending) return;
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setMessage("Informe seu e-mail para recuperar o acesso.");
      return;
    }
    setRecoveryPending(true);
    setMessage("Enviando o link seguro...");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: window.location.origin,
      });
      setMessage(error
        ? "Não foi possível enviar o link agora. Tente novamente."
        : "Link enviado. Abra o e-mail e volte por ele para definir a nova senha.");
    } catch {
      setMessage("Não foi possível enviar o link agora. Tente novamente.");
    } finally {
      setRecoveryPending(false);
    }
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

  async function createActivity(title: string, projectSlug: string | null) {
    const cleanTitle = title.trim();
    if (!cleanTitle || cleanTitle.length > 500) return false;
    if (localMode) {
      try {
        const result = await localHubRequest<{ item: { id: string; titulo: string; projeto: string; status: string; criado: number } }>("/api/hub/tasks", {
          method: "POST",
          body: JSON.stringify({ titulo: cleanTitle, projeto: projectSlug ?? "geral", prioridade: "media" }),
        });
        setTasks((current) => [{ id: result.item.id, title: result.item.titulo, project_slug: result.item.projeto, completed: result.item.status === "concluida", created_at: new Date(result.item.criado * 1000).toISOString() }, ...current]);
        notify("Atividade salva");
        return true;
      } catch (reason) {
        notify(reason instanceof Error ? reason.message : "Não foi possível criar a atividade.");
        return false;
      }
    }
    if (!supabase) return false;
    const { data, error } = await supabase
      .from("hub_tasks")
      .insert({ title: cleanTitle, project_slug: projectSlug })
      .select()
      .single();
    if (error || !data) {
      notify("Não foi possível criar a atividade.");
      return false;
    }
    setTasks((current) => [data as Task, ...current]);
    notify("Atividade salva");
    return true;
  }

  async function createNote(content: string) {
    if (!supabase || !content.trim() || content.length > 5000) return false;
    try {
      const { data, error } = await supabase.from("hub_notes").insert({ content: content.trim() }).select("id,content,created_at").single();
      if (error || !data) throw new Error("save_failed");
      setNotes(current => [data, ...current]); notify("Nota salva"); return true;
    } catch { notify("Não foi possível salvar. Sua nota continua no campo de texto."); return false; }
  }

  async function toggleTask(task: Task) {
    const completed = !task.completed;
    if (localMode) {
      try {
        await localHubRequest(`/api/hub/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status: completed ? "concluida" : "pendente" }) });
        setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed } : item));
        notify(completed ? "Atividade concluída" : "Atividade reaberta");
      } catch (reason) {
        notify(reason instanceof Error ? reason.message : "Não foi possível alterar a atividade.");
      }
      return;
    }
    if (!supabase) return;
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed } : item));
    const { error } = await supabase.from("hub_tasks").update({ completed }).eq("id", task.id);
    if (error) {
      setTasks((current) => current.map((item) => item.id === task.id ? task : item));
      notify("Não foi possível alterar a atividade.");
      return;
    }
    notify(completed ? "Atividade concluída" : "Atividade reaberta");
  }

  async function updateCourseProgress(courseId: string, patch: CourseProgressPatch) {
    if (courseMutationPending.current || (!localMode && (syncing || syncError))) return false;
    courseMutationPending.current = true;
    ++loadVersion.current;
    const owner = sessionUserId;
    const previous = courseProgress.find((item) => item.course_id === courseId);
    let status = (patch.status ?? previous?.status ?? "planned") as CourseProgressStatus;
    const requestedPercent = Number.isFinite(patch.progress_percent)
      ? Math.min(100, Math.max(0, Math.round(patch.progress_percent ?? 0)))
      : Math.min(100, Math.max(0, previous?.progress_percent ?? 0));
    const progressPercent = status === "completed" ? 100 : patch.status === "planned" || (patch.status === "in_progress" && requestedPercent === 100) ? 0 : requestedPercent;
    if (patch.progress_percent !== undefined && progressPercent === 100) status = "completed";
    if (patch.progress_percent !== undefined && progressPercent > 0 && status === "planned") status = "in_progress";
    const next: CourseProgress = {
      course_id: courseId,
      status,
      progress_percent: status === "completed" ? 100 : progressPercent,
      current_step: patch.current_step !== undefined ? patch.current_step : previous?.current_step ?? null,
      next_step: patch.next_step !== undefined ? patch.next_step : previous?.next_step ?? null,
      private_note: patch.private_note !== undefined ? patch.private_note : previous?.private_note ?? null,
      certificate_url: patch.certificate_url !== undefined ? patch.certificate_url : previous?.certificate_url ?? null,
      completed_at: patch.completed_at !== undefined ? patch.completed_at : status === "completed" ? previous?.completed_at ?? new Date().toISOString().slice(0, 10) : null,
      updated_at: new Date().toISOString(),
    };
    const optimistic = [...courseProgress.filter((item) => item.course_id !== courseId), next];
    setCourseProgress(optimistic);
    setSavingCourseId(courseId);
    try {
      if (localMode) {
        window.localStorage.setItem("artx-course-progress", JSON.stringify(optimistic));
      } else {
        if (!supabase || !sessionUserId) throw new Error("missing_session");
        const { error } = await supabase.from("hub_course_progress").upsert({
          user_id: sessionUserId,
          course_id: courseId,
          status: next.status,
          progress_percent: next.progress_percent,
          current_step: next.current_step,
          next_step: next.next_step,
          private_note: next.private_note,
          certificate_url: next.certificate_url,
          completed_at: next.completed_at,
          updated_at: next.updated_at,
        }, { onConflict: "user_id,course_id" });
        if (error) throw error;
      }
      if (!localMode && owner !== sessionIdentity.current) return false;
      notify(patch.certificate_url !== undefined ? "Certificado anexado" : patch.status !== undefined ? "Status atualizado" : "Anotação salva");
      return true;
    } catch {
      if (!localMode && owner !== sessionIdentity.current) return false;
      setCourseProgress((current) => previous
        ? [...current.filter((item) => item.course_id !== courseId), previous]
        : current.filter((item) => item.course_id !== courseId));
      notify("Não foi possível salvar a alteração. Tente novamente.");
      return false;
    } finally {
      courseMutationPending.current = false;
      setSavingCourseId(null);
    }
  }

  async function attachCourseCertificate(courseId: string, file: File): Promise<boolean> {
    if (certificateOperation.current || courseMutationPending.current) return false;
    if (courseProgress.find((item) => item.course_id === courseId)?.status !== "completed") return false;
    certificateOperation.current = true;
    setCertificateBusyId(courseId);
    const owner = localMode ? "local" : sessionUserId;
    const origin = localMode ? null : process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
    let uploadedPath: string | null = null;
    let reference: string | null = null;
    let committed = false;
    try {
      if (!owner || (!localMode && (!supabase || !origin))) throw new Error("Entre na sua conta para anexar o certificado.");
      await validateCertificate(file);
      const path = certificatePath(owner, courseId, file.name);
      reference = certificateReference(origin, path);
      if (localMode) await localCertificate("put", reference, file);
      else {
        const { error } = await supabase!.storage.from(certificateBucket).upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw new Error("Não foi possível enviar o certificado. Confira a conexão e o acesso ao cofre.");
      }
      uploadedPath = path;
      if (!localMode && owner !== sessionIdentity.current) throw new Error("A sessão mudou. Entre novamente para anexar.");
      committed = await updateCourseProgress(courseId, { certificate_url: reference });
      return committed;
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível anexar o certificado.");
      return false;
    } finally {
      // Roll back only the newly uploaded file if saving its reference failed.
      if (!committed && uploadedPath && reference) {
        if (localMode) await localCertificate("delete", reference).catch(() => undefined);
        else await supabase?.storage.from(certificateBucket).remove([uploadedPath]).catch(() => undefined);
      }
      certificateOperation.current = false;
      setCertificateBusyId(null);
    }
  }

  async function retrieveCourseCertificate(courseId: string, reference: string) {
    if (certificateOperation.current) return;
    certificateOperation.current = true;
    setCertificateBusyId(courseId);
    try {
      const owner = localMode ? "local" : sessionUserId;
      const origin = localMode ? null : process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
      if (!owner || !isStoredCertificate(reference)) throw new Error("Certificado indisponível.");
      const { path, name } = parseCertificateReference(reference, origin, owner, courseId);
      let blob: Blob | undefined;
      if (localMode) blob = await localCertificate("get", reference);
      else {
        if (!supabase || !origin) throw new Error("Entre novamente para baixar o certificado.");
        const result = await supabase.storage.from(certificateBucket).download(path);
        if (result.error) throw new Error("Não foi possível baixar o certificado. Tente novamente.");
        if (owner !== sessionIdentity.current) throw new Error("A sessão mudou. Entre novamente.");
        blob = result.data;
      }
      if (!blob) throw new Error("O arquivo não foi encontrado neste dispositivo.");
      downloadCertificate(blob, name);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível baixar o certificado.");
    } finally {
      certificateOperation.current = false;
      setCertificateBusyId(null);
    }
  }

  function goTo(view: View) {
    setActiveView(view);
    setSidebarOpen(false);
  }

  function registerSystemSignal(project: ProjectKey, signal: Omit<SystemSignal, "updatedAt">) {
    setSystemSignals(current => ({ ...current, [project]: { ...signal, updatedAt: new Date().toISOString() } }));
  }

  function downloadHubBackup() {
    const blob = new Blob([JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), tasks, notes, courseProgress, systemSignals }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `artx-hub-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    notify("Backup do Hub exportado");
  }

  if (!sessionReady) {
    return <main className="loading"><img className="loading-logo" src={assetPath("/brand/artx-hub.svg")} alt="ARTX Hub" /><p>Abrindo sua central...</p></main>;
  }
  if (!supabase && !localMode) return <SetupScreen />;
  if (recoveryMode) return <ResetPassword password={newPassword} message={message} onPassword={setNewPassword} onSubmit={resetPassword} />;
  if (!signedIn) return <Login email={email} password={password} message={message} pending={loginPending} recoveryPending={recoveryPending} onEmail={setEmail} onPassword={setPassword} onSubmit={login} onRecover={requestPasswordReset} />;

  const activeWorkspace = isWorkspaceView(activeView) ? workspaces[activeView] : null;
  const page = pageMeta[activeView];

  const commands: CommandItem[] = [
    { id: "overview", group: "Navegar", label: "Abrir visão geral", icon: LayoutDashboard, run: () => goTo("overview") },
    { id: "site", group: "Sistemas", label: "Abrir Site KauaArtx", icon: Compass, run: () => goTo("site") },
    { id: "videos", group: "Sistemas", label: "Abrir KauaArtx Video Studio", icon: Video, run: () => goTo("videos") },
    { id: "sat", group: "Sistemas", label: "Abrir SAT & English Learning", icon: GraduationCap, run: () => goTo("sat") },
    { id: "university", group: "Estudos", label: "Abrir University Path", icon: GraduationCap, run: () => goTo("university") },
    { id: "career", group: "Estudos", label: "Abrir Currículo & Cursos", icon: Award, run: () => goTo("career") },

    { id: "activity", group: "Pessoal", label: "Criar uma atividade", icon: Sparkles, run: () => goTo("overview") },
    { id: "backup", group: "Segurança", label: "Exportar backup do Hub", icon: Cloud, run: downloadHubBackup },
    ...tasks.slice(0, 20).map(task => ({ id: `task-${task.id}`, group: "Atividades", label: task.title, icon: CheckCircle2, run: () => goTo("overview") })),
    ...notes.slice(0, 20).map(note => ({ id: `note-${note.id}`, group: "Notas", label: note.content.slice(0, 90), icon: Command, run: () => goTo("overview") })),
  ];

  return <main className={`hub-shell ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}>
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="sidebar-top">
        <button className="brand" onClick={() => goTo("overview")} aria-label="Abrir visão geral do ARTX Hub">
          <img className="brand-logo" src={assetPath("/brand/artx-hub.svg")} alt="" />
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
      <SidebarGroup label="Canal">
        <NavButton active={activeView === "site"} icon={Compass} logo={workspaces.site.logo} label="Site KauaArtx" onClick={() => goTo("site")} />
        <NavButton active={activeView === "videos"} icon={Video} logo={workspaces.videos.logo} label="KauaArtx Video Studio" onClick={() => goTo("videos")} />
      </SidebarGroup>
      <SidebarGroup label="Estudos">
        <NavButton active={activeView === "sat"} icon={GraduationCap} logo={workspaces.sat.logo} label="SAT & English Learning" onClick={() => goTo("sat")} />
        <NavButton active={activeView === "university"} icon={GraduationCap} logo={workspaces.university.logo} label="University Path" onClick={() => goTo("university")} />
        <NavButton active={activeView === "career"} icon={Award} label="Currículo & Cursos" onClick={() => goTo("career")} badge={courseProgress.filter((item) => courseCatalog.some((course) => course.id === item.course_id) && item.status === "in_progress").length} />
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
          <button className="quick-create" onClick={() => goTo("overview")}><Sparkles size={16} /><span>Meu foco</span></button>
          <button className="synced sync-status" onClick={() => void loadWorkspace()} title="Atualizar dados" aria-live="polite"><Cloud size={15} /><span>{syncing ? "Sincronizando…" : syncError ? "Verificar conexão" : localMode ? "Local" : "Sincronizado"}</span></button>
          {!localMode && supabase && <button className="icon-button" onClick={() => void supabase.auth.signOut()} title="Sair" aria-label="Sair"><LogOut size={17} /></button>}
        </div>
      </header>

      {activeView === "overview" && <PersonalDashboard tasks={tasks} notes={notes} systemSignals={systemSignals} syncing={syncing} syncError={syncError} onOpen={goTo} onCreate={createActivity} onToggle={toggleTask} onNote={createNote} onRetry={() => void loadWorkspace()} onBackup={downloadHubBackup} />}
      {activeView === "career" && <CoursesResume progress={courseProgress} savingCourseId={savingCourseId ?? certificateBusyId ?? (!localMode && (syncing || syncError) ? "sync" : null)} localOnly={localMode} onUpdate={updateCourseProgress} onAttach={attachCourseCertificate} onDownload={retrieveCourseCertificate} />}
      {activeView === "condor" && <CondorWorkspace
        activities={tasks}
        onCreateActivity={createActivity}
        onToggleActivity={toggleTask}
        onNavigate={goTo}
      />}
      {activeWorkspace && activeView !== "condor" && <WorkspaceView
        workspace={activeWorkspace}
        hubAccessToken={hubAccessToken}
        refreshKey={refreshKey}
        previewMode={previewMode}
        onPreviewMode={setPreviewMode}
        onStatus={registerSystemSignal}
        onRefresh={() => { setRefreshKey((key) => key + 1); notify("Preview atualizado"); }}
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

function NavButton({ active, icon: Icon, logo, label, onClick, badge }: { active: boolean; icon: LucideIcon; logo?: string; label: string; onClick: () => void; badge?: number }) {
  return <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick} title={label}>
    {logo ? <img className="nav-logo" src={logo} alt="" /> : <Icon size={17} strokeWidth={1.8} />}<span className="nav-text">{label}</span>{badge ? <small>{badge}</small> : null}
  </button>;
}

function StatusPill({ tone, children }: { tone: "blue" | "violet" | "amber" | "mint"; children: React.ReactNode }) {
  return <span className={`status-pill ${tone}`}><i />{children}</span>;
}

function EmptyState({ label, compact = false }: { label: string; compact?: boolean }) {
  return <div className={`empty-state ${compact ? "compact" : ""}`}><CheckCircle2 size={16} /><span>{label}</span></div>;
}

function WorkspaceView({ workspace, hubAccessToken, refreshKey, previewMode, onPreviewMode, onRefresh, onStatus }: {
  workspace: Workspace;
  hubAccessToken: string | null;
  refreshKey: number;
  previewMode: "desktop" | "mobile";
  onPreviewMode: (mode: "desktop" | "mobile") => void;
  onRefresh: () => void;
  onStatus: (project: ProjectKey, signal: Omit<SystemSignal, "updatedAt">) => void;
}) {
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    setFocusMode(false);
  }, [workspace.project]);

  useEffect(() => {
    if (!focusMode) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const leaveFocus = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocusMode(false);
    };
    window.addEventListener("keydown", leaveFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", leaveFocus);
    };
  }, [focusMode]);

  return <div className={`workspace-page page-enter side-panel-closed ${focusMode ? "focus-mode" : ""}`}>
    <section className="workspace-hero">
      <img className="workspace-logo" src={workspace.logo} alt={`Logo ${workspace.label}`} />
      <div><p className="eyebrow">{workspace.eyebrow}</p><h2>{workspace.label}</h2><span>{workspace.description}</span></div>
      <div className="workspace-hero-actions"><StatusPill tone={workspace.statusTone}>{workspace.status}</StatusPill><button className="secondary-button" onClick={onRefresh}><RefreshCw size={15} /> Atualizar</button></div>
    </section>
    <section className="workspace-layout">
      <article className={`app-frame-card ${previewMode === "mobile" ? "mobile-preview" : ""}`}>
        <div className="frame-toolbar"><div className="frame-label"><span><i /><i /><i /></span><img src={workspace.logo} alt="" /><strong>{workspace.label}</strong><small>Dentro do ARTX Hub</small></div><div className="frame-controls">
          {workspace.project === "site" && <div className="preview-toggle"><button className={previewMode === "desktop" ? "active" : ""} onClick={() => onPreviewMode("desktop")} aria-label="Visualizar desktop"><Monitor size={14} /></button><button className={previewMode === "mobile" ? "active" : ""} onClick={() => onPreviewMode("mobile")} aria-label="Visualizar celular"><Smartphone size={14} /></button></div>}
          <button className="frame-action focus-action" onClick={() => setFocusMode((current) => !current)} aria-pressed={focusMode} title={focusMode ? "Sair da tela ampla" : "Abrir em tela ampla"}>{focusMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}<span>{focusMode ? "Voltar ao Hub" : "Tela ampla"}</span></button>
          <a href={workspace.url} target="_blank" rel="noreferrer" title="Abrir em outra aba"><ExternalLink size={16} /></a>
        </div></div>
        <div className="frame-stage"><EmbeddedWorkspaceFrame workspace={workspace} accessToken={hubAccessToken} refreshKey={refreshKey} onStatus={onStatus} /></div>
      </article>
    </section>
  </div>;
}

function EmbeddedWorkspaceFrame({ workspace, accessToken, refreshKey, onStatus }: { workspace: Workspace; accessToken: string | null; refreshKey: number; onStatus: (project: ProjectKey, signal: Omit<SystemSignal, "updatedAt">) => void }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const usesHubSession = workspace.project === "videos" || workspace.project === "university" || workspace.project === "sat";
  const sourceUrl = usesHubSession ? `${workspace.url}/embed` : workspace.url!;
  const appOrigin = new URL(workspace.url!).origin;

  const sendHubSession = useCallback(() => {
    if (!usesHubSession || !accessToken) return;
    frameRef.current?.contentWindow?.postMessage({ type: "ARTX_HUB_AUTH", accessToken }, appOrigin);
  }, [accessToken, appOrigin, usesHubSession]);

  useEffect(() => {
    function onWorkspaceReady(event: MessageEvent) {
      if (event.source !== frameRef.current?.contentWindow || event.origin !== appOrigin) return;
      const expectedMessage = workspace.project === "videos" ? "ARTX_VIDEO_EMBED_READY" : workspace.project === "sat" ? "ARTX_STUDY_EMBED_READY" : "UNIVERSITY_PATH_EMBED_READY";
      if (usesHubSession && event.data?.type === expectedMessage) sendHubSession();
      if (event.data?.type === "ARTX_SYSTEM_STATUS" && event.data.system === workspace.project && ["ready", "syncing", "attention"].includes(event.data.state) && typeof event.data.title === "string" && typeof event.data.detail === "string") {
        onStatus(workspace.project, { state: event.data.state, title: event.data.title.slice(0, 100), detail: event.data.detail.slice(0, 180) });
      }
    }
    window.addEventListener("message", onWorkspaceReady);
    const retry = usesHubSession ? window.setTimeout(sendHubSession, 350) : undefined;
    return () => {
      window.removeEventListener("message", onWorkspaceReady);
      if (retry !== undefined) window.clearTimeout(retry);
    };
  }, [accessToken, appOrigin, onStatus, sendHubSession, usesHubSession, workspace.project]);

  return <iframe ref={frameRef} key={refreshKey} src={sourceUrl} title={workspace.label} onLoad={sendHubSession} allow={workspace.project === "sat" ? "clipboard-write; autoplay; fullscreen; microphone https://sat-simulado.vercel.app" : "clipboard-write; autoplay; fullscreen"} />;
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

function Login({ email, password, message, pending, recoveryPending, onEmail, onPassword, onSubmit, onRecover }: { email: string; password: string; message: string; pending: boolean; recoveryPending: boolean; onEmail: (value: string) => void; onPassword: (value: string) => void; onSubmit: (event: React.FormEvent) => void; onRecover: () => void }) {
  return <main className="login"><div className="login-orbit" /><form onSubmit={onSubmit}><div className="login-brand"><img src={assetPath("/brand/artx-hub.svg")} alt="Logo ARTX Hub" /><div><strong>ARTX Hub</strong><small>Central pessoal</small></div></div><p className="eyebrow">ESPAÇO PRIVADO</p><h1>Seu espaço para construir.</h1><p>Entre para acessar seus sistemas e continuar seus estudos e a produção do canal.</p><label>E-mail<input type="email" value={email} onChange={(event) => onEmail(event.target.value)} autoComplete="email" inputMode="email" required /></label><label>Senha<input type="password" value={password} onChange={(event) => onPassword(event.target.value)} autoComplete="current-password" required /></label><button className="login-recovery" type="button" onClick={onRecover} disabled={pending || recoveryPending}>{recoveryPending ? "Enviando link..." : "Esqueci minha senha"}</button>{message && <span className="message" aria-live="polite">{message}</span>}<button className="primary" type="submit" disabled={pending || recoveryPending}>{pending ? "Verificando..." : "Entrar no Hub"} {!pending && <ArrowUpRight size={16} />}</button><small className="login-footer"><span /> Acesso particular e sincronizado</small></form></main>;
}

function ResetPassword({ password, message, onPassword, onSubmit }: { password: string; message: string; onPassword: (value: string) => void; onSubmit: (event: React.FormEvent) => void }) {
  return <main className="login"><div className="login-orbit" /><form onSubmit={onSubmit}><div className="login-brand"><img src={assetPath("/brand/artx-hub.svg")} alt="Logo ARTX Hub" /><div><strong>ARTX Hub</strong><small>Central pessoal</small></div></div><p className="eyebrow">ACESSO RECUPERADO</p><h1>Defina a nova senha.</h1><p>Escolha uma senha com pelo menos 8 caracteres para concluir o acesso.</p><label>Nova senha<input type="password" value={password} onChange={(event) => onPassword(event.target.value)} minLength={8} autoComplete="new-password" required autoFocus /></label>{message && <span className="message" aria-live="polite">{message}</span>}<button className="primary" type="submit">Salvar nova senha <Check size={16} /></button></form></main>;
}

function SetupScreen() {
  return <main className="login"><div className="login-orbit" /><div className="setup-card"><img className="setup-logo" src={assetPath("/brand/artx-hub.svg")} alt="Logo ARTX Hub" /><p className="eyebrow">CONFIGURAÇÃO NECESSÁRIA</p><h1>Conecte o Hub.</h1><p>Adicione a URL e a chave pública do Supabase em <code>.env.local</code>. O guia completo está no README.</p></div></main>;
}
