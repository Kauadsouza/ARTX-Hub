"use client";

import { ArrowUpRight, Check, Circle, Compass, Video } from "lucide-react";
import { useState } from "react";

type Task = { id: string; title: string; project_slug: string | null; completed: boolean };
export function PersonalFocus({ tasks, onToggle, onOpen }: { tasks: Task[]; onToggle: (task: Task) => Promise<void>; onOpen: (view: "videos" | "site") => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const focus = tasks.filter(t => !t.completed).slice(0,3);
  return <section className="personal-focus"><div className="focus-today"><span className="eyebrow">UMA COISA DE CADA VEZ</span><h2>O que merece sua atenção?</h2><p>Seus primeiros passos em aberto. Conclua um e o próximo aparece aqui.</p><div>{focus.map((task,index)=><div key={task.id} className="focus-task"><span>0{index+1}</span><strong>{task.title}</strong><button disabled={busy === task.id} aria-label={`Concluir foco: ${task.title}`} onClick={async()=>{setBusy(task.id);setError("");try{await onToggle(task);}catch{setError("Não foi possível concluir. Tente novamente.");}finally{setBusy(null);}}}>{busy === task.id ? <Circle size={17}/> : <Check size={17}/>}</button></div>)}{!focus.length && <p className="focus-empty">Sua mesa está livre. Adicione uma atividade no Meu foco ou abra o estúdio para escolher um vídeo.</p>}</div>{error && <p role="alert">{error}</p>}</div><aside className="focus-shortcuts"><span className="eyebrow">SEUS ATALHOS DE CRIAÇÃO</span><button onClick={()=>onOpen("videos")}><Video size={19}/><span><strong>Meu estúdio</strong><small>Produção, ideias e agenda</small></span><ArrowUpRight size={17}/></button><button onClick={()=>onOpen("site")}><Compass size={19}/><span><strong>Meu site pessoal</strong><small>Veja o que os visitantes encontram</small></span><ArrowUpRight size={17}/></button><a href="https://studio.youtube.com/" target="_blank" rel="noopener noreferrer"><span><strong>YouTube Studio</strong><small>Publicar e acompanhar o canal</small></span><ArrowUpRight size={17}/></a></aside></section>;
}
