import assert from "node:assert/strict";
import { test } from "node:test";

import { buildWeek, daysUntil, parseRouteSignals, projectLabel } from "../src/lib/week-ahead.ts";

const agora = new Date("2026-09-18T12:00:00Z");

function tarefa(id, slug, completed = false) {
  return { id, title: `tarefa ${id}`, project_slug: slug, completed };
}

// ───────────── Sem dado não há linha, e isso não é um erro ─────────────

test("sem nada para mostrar a lista sai vazia", () => {
  assert.deepEqual(buildWeek({ now: agora }), []);
  assert.deepEqual(buildWeek({ routes: null, tasks: [], now: agora }), []);
});

test("tarefas todas concluídas não geram linha", () => {
  const sinais = buildWeek({ tasks: [tarefa("a", "videos", true), tarefa("b", null, true)], now: agora });
  assert.deepEqual(sinais, []);
});

test("rota sem prazo e sem universidade não inventa urgência", () => {
  const sinais = buildWeek({
    routes: { routeCount: 0, nextDeadline: null, chosenUniversities: 0 },
    now: agora,
  });
  assert.deepEqual(sinais, []);
});

// ───────────────────────── Prazos ─────────────────────────

test("o prazo vira uma linha com a contagem de dias pronta", () => {
  const sinais = buildWeek({
    routes: {
      routeCount: 1,
      chosenUniversities: 2,
      nextDeadline: { routeName: "Reino Unido 2027", country: "uk", label: "Prazo do UCAS", date: "2026-10-15" },
    },
    now: agora,
  });
  const prazo = sinais.find((sinal) => sinal.id === "deadline");
  assert.ok(prazo);
  assert.equal(prazo.value, "27 dias");
  assert.equal(prazo.target, "university");
  assert.match(prazo.detail, /Reino Unido 2027/);
});

test("prazo de hoje e de amanhã são escritos como gente escreve", () => {
  const base = { routeCount: 1, chosenUniversities: 1 };
  const hoje = buildWeek({
    routes: { ...base, nextDeadline: { routeName: "R", country: "uk", label: "L", date: "2026-09-18T23:00:00Z" } },
    now: agora,
  });
  assert.equal(hoje[0].value, "hoje");

  const amanha = buildWeek({
    routes: { ...base, nextDeadline: { routeName: "R", country: "uk", label: "L", date: "2026-09-19T12:00:00Z" } },
    now: agora,
  });
  assert.equal(amanha[0].value, "1 dia");
});

test("prazo que já passou não vira linha", () => {
  const sinais = buildWeek({
    routes: {
      routeCount: 1,
      chosenUniversities: 1,
      nextDeadline: { routeName: "R", country: "uk", label: "L", date: "2026-01-01" },
    },
    now: agora,
  });
  assert.equal(sinais.find((sinal) => sinal.id === "deadline"), undefined);
});

test("prazo apertado sobe na ordem, prazo distante desce", () => {
  const perto = buildWeek({
    routes: { routeCount: 1, chosenUniversities: 1, nextDeadline: { routeName: "R", country: "uk", label: "L", date: "2026-09-22" } },
    tasks: [tarefa("a", "videos")],
    now: agora,
  });
  assert.equal(perto[0].id, "deadline", "prazo de 4 dias vem antes das tarefas");

  const longe = buildWeek({
    routes: { routeCount: 1, chosenUniversities: 1, nextDeadline: { routeName: "R", country: "uk", label: "L", date: "2027-06-01" } },
    tasks: Array.from({ length: 12 }, (_, i) => tarefa(String(i), "videos")),
    now: agora,
  });
  assert.equal(longe[0].id, "tasks", "prazo a mais de um ano não passa na frente de 12 pendências");
});

// ───────────────────── Rota sem destino ─────────────────────

test("rota criada sem universidade escolhida vira um lembrete", () => {
  const sinais = buildWeek({
    routes: { routeCount: 2, chosenUniversities: 0, nextDeadline: null },
    now: agora,
  });
  const lembrete = sinais.find((sinal) => sinal.id === "no-universities");
  assert.ok(lembrete);
  assert.equal(lembrete.value, "2");
  assert.match(lembrete.detail, /rotas/);
});

test("uma rota só é dita no singular", () => {
  const sinais = buildWeek({ routes: { routeCount: 1, chosenUniversities: 0, nextDeadline: null }, now: agora });
  assert.match(sinais[0].detail, /^rota /);
});

test("com universidade escolhida o lembrete some", () => {
  const sinais = buildWeek({ routes: { routeCount: 1, chosenUniversities: 3, nextDeadline: null }, now: agora });
  assert.equal(sinais.find((sinal) => sinal.id === "no-universities"), undefined);
});

// ───────────────────────── Tarefas ─────────────────────────

test("a linha de tarefas aponta o sistema com mais pendência", () => {
  const sinais = buildWeek({
    tasks: [tarefa("a", "videos"), tarefa("b", "videos"), tarefa("c", "videos"), tarefa("d", "sat")],
    now: agora,
  });
  const tarefas = sinais.find((sinal) => sinal.id === "tasks");
  assert.ok(tarefas);
  assert.equal(tarefas.target, "videos");
  assert.equal(tarefas.value, "3");
  assert.match(tarefas.title, /4 passos/);
});

test("tarefa sem projeto cai em Pessoal, não some", () => {
  const sinais = buildWeek({ tasks: [tarefa("a", null)], now: agora });
  assert.match(sinais[0].detail, /Pessoal/);
  assert.equal(sinais[0].target, "overview");
});

test("uma tarefa só é dita no singular", () => {
  const sinais = buildWeek({ tasks: [tarefa("a", "sat")], now: agora });
  assert.equal(sinais[0].title, "1 passo em aberto");
});

// ──────────────── Leitura do resumo publicado ────────────────

test("payload ausente ou estranho devolve null em vez de quebrar", () => {
  for (const entrada of [null, undefined, 42, "texto", {}, { signals: null }, { signals: "x" }]) {
    assert.equal(parseRouteSignals(entrada), null, `${JSON.stringify(entrada)} deveria devolver null`);
  }
});

test("resumo válido é lido inteiro", () => {
  const lido = parseRouteSignals({
    signals: {
      routeCount: 2,
      chosenUniversities: 5,
      nextDeadline: { routeName: "EUA 2027", country: "us", label: "Regular Decision", date: "2027-01-01" },
    },
  });
  assert.ok(lido);
  assert.equal(lido.routeCount, 2);
  assert.equal(lido.chosenUniversities, 5);
  assert.equal(lido.nextDeadline?.routeName, "EUA 2027");
});

test("data inválida no resumo é descartada sem derrubar o resto", () => {
  const lido = parseRouteSignals({
    signals: { routeCount: 1, chosenUniversities: 0, nextDeadline: { date: "não é data" } },
  });
  assert.ok(lido);
  assert.equal(lido.nextDeadline, null);
  assert.equal(lido.routeCount, 1);
});

test("campos faltando viram zero, não NaN", () => {
  const lido = parseRouteSignals({ signals: {} });
  assert.ok(lido);
  assert.equal(lido.routeCount, 0);
  assert.equal(lido.chosenUniversities, 0);
});

test("daysUntil e projectLabel se comportam", () => {
  assert.equal(daysUntil("2026-09-28T12:00:00Z", agora), 10);
  assert.equal(projectLabel("sat"), "Idiomas");
  assert.equal(projectLabel("desconhecido"), "desconhecido");
});
