"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, Circle, ClipboardList, LogOut, Plus, Sparkles, StickyNote, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { projects } from "@/lib/projects";

type Note = { id: string; content: string; project_slug: string | null; created_at: string };
type Task = { id: string; title: string; project_slug: string | null; completed: boolean };

export function Hub() {
  const supabase = useMemo(createClient, []);
  const [sessionReady, setSessionReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [noteText, setNoteText] = useState("");
  const [taskText, setTaskText] = useState("");
  const [project, setProject] = useState<string>("geral");

  useEffect(() => {
    if (!supabase) { setSessionReady(true); return; }
    supabase.auth.getSession().then(({ data }) => { setSignedIn(Boolean(data.session)); setSessionReady(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !signedIn) return;
    Promise.all([
      supabase.from("hub_notes").select("*").order("created_at", { ascending: false }).limit(8),
      supabase.from("hub_tasks").select("*").order("created_at", { ascending: false }).limit(10),
    ]).then(([noteResult, taskResult]) => {
      setNotes((noteResult.data as Note[]) ?? []);
      setTasks((taskResult.data as Task[]) ?? []);
    });
  }, [signedIn, supabase]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setMessage("Entrando...");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setMessage(error ? "E-mail ou senha inválidos." : "");
  }

  async function addNote() {
    if (!supabase || !noteText.trim()) return;
    const { data, error } = await supabase.from("hub_notes").insert({ content: noteText.trim(), project_slug: project === "geral" ? null : project }).select().single();
    if (!error && data) { setNotes((current) => [data as Note, ...current]); setNoteText(""); }
  }

  async function addTask() {
    if (!supabase || !taskText.trim()) return;
    const { data, error } = await supabase.from("hub_tasks").insert({ title: taskText.trim(), project_slug: project === "geral" ? null : project }).select().single();
    if (!error && data) { setTasks((current) => [data as Task, ...current]); setTaskText(""); }
  }

  async function toggleTask(task: Task) {
    if (!supabase) return;
    const completed = !task.completed;
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed } : item));
    await supabase.from("hub_tasks").update({ completed }).eq("id", task.id);
  }

  if (!sessionReady) return <main className="loading">Abrindo seu espaço...</main>;
  if (!supabase) return <SetupScreen />;
  if (!signedIn) return <Login email={email} password={password} message={message} onEmail={setEmail} onPassword={setPassword} onSubmit={login} />;

  const openTasks = tasks.filter((task) => !task.completed).length;
  return <main className="shell">
    <header className="topbar"><div className="brand"><span>ARTX</span> Hub</div><div className="profile"><span>Espaço pessoal</span><button onClick={() => supabase.auth.signOut()} title="Sair"><LogOut size={17} /></button></div></header>
    <section className="hero"><p className="eyebrow"><Sparkles size={15} /> CENTRAL DE COMANDO</p><h1>Seu trabalho, numa visão só.</h1><p>Projetos, progresso e ideias — organizados para você continuar avançando.</p></section>
    <section className="project-grid">{projects.map((item) => { const Icon = item.icon; return <article className={`project-card ${item.color}`} key={item.slug}><div className="card-head"><span className="icon"><Icon size={20} /></span><span className="status">{item.status}</span></div><h2>{item.name}</h2><p>{item.description}</p>{item.url ? <a href={item.url} target="_blank" rel="noreferrer">Abrir sistema <ArrowUpRight size={16} /></a> : <span className="local">Disponível no seu PC</span>}</article>; })}</section>
    <section className="workspace">
      <div className="panel capture"><div className="panel-title"><StickyNote size={18} /><div><h2>Capturar uma ideia</h2><p>Ela sincroniza no celular e no computador.</p></div></div><textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Ex.: melhorar a página inicial do site com..." /><div className="panel-actions"><ProjectPicker value={project} onChange={setProject} /><button className="primary" onClick={addNote}><Plus size={16} /> Salvar nota</button></div></div>
      <div className="panel"><div className="panel-title"><ClipboardList size={18} /><div><h2>Próximos passos</h2><p>{openTasks ? `${openTasks} pendente${openTasks > 1 ? "s" : ""}` : "Tudo em dia por aqui."}</p></div></div><div className="add-task"><input value={taskText} onChange={(event) => setTaskText(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addTask()} placeholder="Adicionar uma tarefa" /><button onClick={addTask}><Plus size={17} /></button></div><div className="task-list">{tasks.length === 0 ? <p className="empty">Adicione o que você quer fazer a seguir.</p> : tasks.map((task) => <button className={`task ${task.completed ? "done" : ""}`} key={task.id} onClick={() => toggleTask(task)}><span>{task.completed ? <Check size={14} /> : <Circle size={14} />}</span><span>{task.title}</span>{task.project_slug && <small>{task.project_slug}</small>}</button>)}</div></div>
    </section>
    <section className="notes"><div className="section-heading"><div><p className="eyebrow">BLOCO DE NOTAS</p><h2>Ideias recentes</h2></div></div><div className="notes-grid">{notes.length === 0 ? <p className="empty">Suas notas vão aparecer aqui.</p> : notes.map((note) => <article key={note.id}><p>{note.content}</p><footer>{note.project_slug ?? "geral"}</footer></article>)}</div></section>
  </main>;
}

function ProjectPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <select value={value} onChange={(event) => onChange(event.target.value)}><option value="geral">Geral</option>{projects.map((project) => <option key={project.slug} value={project.slug}>{project.name}</option>)}</select>; }

function Login({ email, password, message, onEmail, onPassword, onSubmit }: { email: string; password: string; message: string; onEmail: (value: string) => void; onPassword: (value: string) => void; onSubmit: (event: React.FormEvent) => void }) { return <main className="login"><form onSubmit={onSubmit}><p className="eyebrow">ESPAÇO PRIVADO</p><h1>ARTX Hub</h1><p>Entre para acessar seus projetos e suas anotações.</p><label>E-mail<input type="email" value={email} onChange={(event) => onEmail(event.target.value)} required /></label><label>Senha<input type="password" value={password} onChange={(event) => onPassword(event.target.value)} required /></label>{message && <span className="message">{message}</span>}<button className="primary" type="submit">Entrar</button><small>O acesso é só seu.</small></form></main>; }

function SetupScreen() { return <main className="login"><div><p className="eyebrow">CONFIGURAÇÃO NECESSÁRIA</p><h1>Conecte o Hub</h1><p>Copie <code>.env.example</code> para <code>.env.local</code> e adicione as chaves do Supabase. O guia completo está no README.</p></div></main>; }
