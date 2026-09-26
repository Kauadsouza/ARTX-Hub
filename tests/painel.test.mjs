import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ETAPAS,
  lerResumoDeCursos,
  numerosDeCursos,
  ordenarCursos,
  porEtapa,
  progressoDoVideo,
} from '../src/lib/painel.ts';

const bloco = (gravacao, edicao = 'PENDENTE') => ({ gravacao, edicao });

// ══════════════ Vídeos ══════════════

test('ideia é 0% e publicado é 100%', () => {
  assert.equal(progressoDoVideo('IDEIA', []), 0);
  assert.equal(progressoDoVideo('POSTADO', []), 1);
});

test('publicado é 100% mesmo com bloco pendente: o vídeo já saiu', () => {
  assert.equal(progressoDoVideo('POSTADO', [bloco('PENDENTE')]), 1);
});

test('cada etapa concluída soma uma fatia igual', () => {
  // Com tolerância: 5/7 e 5 × (1/7) diferem na última casa em ponto flutuante.
  const fatia = 1 / (ETAPAS.length - 1);
  assert.ok(Math.abs(progressoDoVideo('GRAVACAO', []) - 2 * fatia) < 1e-9);
  assert.ok(Math.abs(progressoDoVideo('REVISAO', []) - 5 * fatia) < 1e-9);
});

test('na gravação, o avanço dos blocos conta dentro da fatia', () => {
  const fatia = 1 / (ETAPAS.length - 1);
  const metade = progressoDoVideo('GRAVACAO', [bloco('PRONTO'), bloco('PENDENTE')]);
  assert.ok(Math.abs(metade - (2 + 0.5) * fatia) < 1e-9);
});

test('bloco em andamento vale meio', () => {
  const fatia = 1 / (ETAPAS.length - 1);
  assert.ok(Math.abs(progressoDoVideo('GRAVACAO', [bloco('EM_PROGRESSO')]) - 2.5 * fatia) < 1e-9);
});

test('na edição, conta o estado de edição — não o de gravação', () => {
  const fatia = 1 / (ETAPAS.length - 1);
  const v = progressoDoVideo('EDICAO', [bloco('PRONTO', 'PENDENTE'), bloco('PRONTO', 'PENDENTE')]);
  assert.equal(v, 3 * fatia, 'gravação pronta não adianta nada na etapa de edição');
});

test('roteiro com blocos já começou; sem blocos, não', () => {
  const fatia = 1 / (ETAPAS.length - 1);
  assert.equal(progressoDoVideo('ROTEIRO', []), fatia);
  assert.equal(progressoDoVideo('ROTEIRO', [bloco('PENDENTE')]), 1.5 * fatia);
});

test('etapa desconhecida vira 0 em vez de explodir ou inventar', () => {
  assert.equal(progressoDoVideo('ETAPA_NOVA', []), 0);
});

test('o progresso nunca passa de 100%', () => {
  const tudoPronto = Array.from({ length: 5 }, () => bloco('PRONTO', 'PRONTO'));
  for (const etapa of ETAPAS) assert.ok(progressoDoVideo(etapa, tudoPronto) <= 1, etapa);
});

test('a contagem por etapa traz as oito, inclusive as vazias', () => {
  const contagem = porEtapa([{ etapa: 'ROTEIRO' }, { etapa: 'ROTEIRO' }, { etapa: 'POSTADO' }]);
  assert.equal(contagem.length, 8, 'um funil com buraco esconde onde a produção trava');
  assert.equal(contagem.find(e => e.etapa === 'ROTEIRO').total, 2);
  assert.equal(contagem.find(e => e.etapa === 'EDICAO').total, 0);
});

// ══════════════ Cursos ══════════════

test('lê o resumo que o sistema de cursos grava', () => {
  const cursos = lerResumoDeCursos({ resumo: [{ id: 'cs50x', titulo: 'CS50x', categoria: 'programacao', feitas: 3, total: 22 }] });
  assert.deepEqual(cursos, [{ id: 'cs50x', titulo: 'CS50x', categoria: 'programacao', feitas: 3, total: 22 }]);
});

test('sem resumo ainda, a lista é vazia — não um erro', () => {
  assert.deepEqual(lerResumoDeCursos(null), []);
  assert.deepEqual(lerResumoDeCursos({}), []);
  assert.deepEqual(lerResumoDeCursos({ resumo: 'lixo' }), []);
});

test('linha torta sai em vez de virar barra de 140%', () => {
  const cursos = lerResumoDeCursos({ resumo: [
    { id: 'a', titulo: 'A', feitas: 30, total: 10 },
    { id: 'b', titulo: 'B', feitas: 1, total: 0 },
    { id: 'c', titulo: 'C', feitas: -2, total: 5 },
    { titulo: 'sem id', feitas: 1, total: 2 },
  ] });
  assert.equal(cursos.length, 1);
  assert.equal(cursos[0].feitas, 10, 'feitas maior que total é cortado no total');
});

test('os números separam em andamento, concluído e não começado', () => {
  const n = numerosDeCursos([
    { id: 'a', titulo: 'A', categoria: '', feitas: 3, total: 10 },
    { id: 'b', titulo: 'B', categoria: '', feitas: 10, total: 10 },
    { id: 'c', titulo: 'C', categoria: '', feitas: 0, total: 8 },
  ]);
  assert.deepEqual(n, { emAndamento: 1, concluidos: 1, naoIniciados: 1, aulasFeitas: 13 });
});

test('a ordem é a de "o que eu faço agora": andamento, concluído, não começado', () => {
  const ordem = ordenarCursos([
    { id: 'parado', titulo: 'Z', categoria: '', feitas: 0, total: 5 },
    { id: 'feito', titulo: 'Y', categoria: '', feitas: 5, total: 5 },
    { id: 'quase', titulo: 'X', categoria: '', feitas: 4, total: 5 },
    { id: 'comecando', titulo: 'W', categoria: '', feitas: 1, total: 5 },
  ]).map(c => c.id);
  assert.deepEqual(ordem, ['quase', 'comecando', 'feito', 'parado']);
});

// ══════════════ Ritmo e linha do tempo ══════════════

import { acontecimentos, aulasNosUltimos, haQuanto, lerEstudo, ultimosDias } from '../src/lib/painel.ts';

test('o ritmo lido do banco descarta o que vier torto', () => {
  const e = lerEstudo({ estudo: { sequencia: 3, porDia: { '2026-09-26': 2, 'lixo': 5, '2026-09-25': -1 }, recentes: [{ curso: 'CS50x', aula: 'C', numero: 3, quando: '2026-09-26T10:00:00Z' }, { curso: 'x' }] } });
  assert.deepEqual(e.porDia, { '2026-09-26': 2 });
  assert.equal(e.recentes.length, 1);
  assert.equal(e.sequencia, 3);
});

test('sem ritmo gravado ainda, é nulo — não um erro', () => {
  assert.equal(lerEstudo(null), null);
  assert.equal(lerEstudo({ resumo: [] }), null);
});

test('os últimos dias vêm todos, inclusive os vazios, em ordem', () => {
  const agora = new Date('2026-09-26T12:00:00Z');
  const dias = ultimosDias({ '2026-09-26': 2, '2026-09-24': 1 }, 3, agora);
  assert.deepEqual(dias, [{ dia: '2026-09-24', aulas: 1 }, { dia: '2026-09-25', aulas: 0 }, { dia: '2026-09-26', aulas: 2 }]);
  assert.equal(aulasNosUltimos({ '2026-09-26': 2, '2026-09-24': 1 }, 7, agora), 3);
});

test('a linha do tempo mistura as três origens, a mais recente primeiro', () => {
  const lista = acontecimentos({
    estudo: { sequencia: 1, porDia: {}, recentes: [{ curso: 'CS50x', aula: 'C', numero: 3, quando: '2026-09-26T10:00:00Z' }] },
    videos: [{ id: 'v', titulo: 'Vlog', etapa: 'GRAVACAO', rotulo: 'Gravação', progresso: 0.29, atualizadoEm: '2026-09-26T12:00:00Z' }],
    pedidos: [{ usuario: 'maria', sistemas: ['Cursos'], quando: '2026-09-26T11:00:00Z' }],
  });
  assert.deepEqual(lista.map(a => a.tipo), ['video', 'pedido', 'aula']);
  assert.equal(lista[2].titulo, 'Aula 3 — C');
  assert.equal(lista[0].etapa, 'Gravação');
  assert.equal(lista[0].progresso, 0.29);
  assert.deepEqual(lista[1].sistemas, ['Cursos']);
});

test('data inválida fica fora da linha do tempo em vez de ir para o topo', () => {
  const lista = acontecimentos({ estudo: null, videos: null, pedidos: [{ usuario: 'x', sistemas: [], quando: 'ontem à noite' }] });
  assert.deepEqual(lista, []);
});

test('o tempo relativo fala como gente', () => {
  const agora = new Date('2026-09-26T12:00:00Z');
  assert.equal(haQuanto('2026-09-26T11:59:30Z', agora), 'agora');
  assert.equal(haQuanto('2026-09-26T11:55:00Z', agora), 'há 5 min');
  assert.equal(haQuanto('2026-09-26T09:00:00Z', agora), 'há 3 h');
  assert.equal(haQuanto('2026-09-25T10:00:00Z', agora), 'ontem');
  assert.equal(haQuanto('2026-09-22T12:00:00Z', agora), 'há 4 dias');
});
