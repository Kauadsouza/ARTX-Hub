"use client";

import { ArrowUpRight, CalendarClock } from "lucide-react";

import { buildWeek, type RouteSignals, type Task } from "@/lib/week-ahead";

/**
 * A faixa do topo do Hub.
 *
 * Cada linha vem de um dado real e desaparece quando o dado desaparece. Não há
 * frase de efeito aqui: o número fica grande, o rótulo fica curto e o clique
 * leva direto ao sistema onde a coisa se resolve.
 */
export function WeekAhead({
  routes,
  tasks,
  onOpen,
}: {
  routes: RouteSignals | null;
  tasks: Task[];
  onOpen: (view: "site" | "videos" | "sat" | "university" | "condor" | "overview") => void;
}) {
  const signals = buildWeek({ routes, tasks });
  if (signals.length === 0) return null;

  return (
    <section className="week-ahead" aria-label="O que está próximo">
      <header>
        <CalendarClock size={15} />
        <span>O QUE ESTÁ PRÓXIMO</span>
      </header>
      <div className="week-grid">
        {signals.map((signal) => (
          <button
            key={signal.id}
            type="button"
            className={`week-card ${signal.urgency}`}
            onClick={() => onOpen(signal.target)}
          >
            <strong>{signal.value}</strong>
            <span>{signal.title}</span>
            <small>{signal.detail}</small>
            <ArrowUpRight size={15} aria-hidden />
          </button>
        ))}
      </div>
    </section>
  );
}
