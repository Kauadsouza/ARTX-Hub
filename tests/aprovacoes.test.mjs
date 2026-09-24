import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  acoesDoEstado,
  agrupar,
  contarSelecionados,
  estadoDaConta,
  idsDaConta,
  selecoesDoServidor,
} from '../src/lib/aprovacoes.ts';

const pessoa = (username, createdAt = '2026-09-01') => ({ username, createdAt });
const grant = (memberId, app, status, username = 'kauaartx') => ({
  memberId, app, status, member: pessoa(username),
});

// ══════════════ O defeito que fazia a tela mentir ══════════════

test('recarregar assume a verdade do servidor, não o estado anterior da tela', () => {
  // Antes: `current[key]?.[app] ?? servidor` — o local nunca é undefined depois
  // da primeira carga, então o servidor deixava de ser ouvido para sempre.
  const antes = selecoesDoServidor([grant('m1', 'videos', 'approved'), grant('m1', 'study', 'revoked')]);
  assert.equal(antes.kauaartx.videos, true);
  assert.equal(antes.kauaartx.study, false);

  // A conta é bloqueada: o servidor revoga tudo.
  const depois = selecoesDoServidor([grant('m1', 'videos', 'revoked'), grant('m1', 'study', 'revoked')]);
  assert.equal(depois.kauaartx.videos, false, 'a caixa tem que desmarcar quando o banco revogou');
  assert.equal(depois.kauaartx.study, false);
});

test('o acesso ao Hub não vira caixa de sistema', () => {
  const s = selecoesDoServidor([grant('m1', 'hub', 'approved'), grant('m1', 'videos', 'approved')]);
  assert.deepEqual(Object.keys(s.kauaartx), ['videos'], 'o Hub não é um dos sistemas marcáveis');
});

test('sem nenhuma concessão, nenhuma seleção é inventada', () => {
  assert.deepEqual(selecoesDoServidor([]), {});
});

// ══════════════ Estado da conta ══════════════

test('o acesso ao Hub é o que decide o estado', () => {
  const conta = (hubStatus) => agrupar([grant('m1', 'hub', hubStatus), grant('m1', 'videos', 'approved')])[0];
  assert.equal(estadoDaConta(conta('approved')), 'ativa');
  assert.equal(estadoDaConta(conta('pending')), 'aguardando');
  assert.equal(estadoDaConta(conta('revoked')), 'bloqueada');
});

test('conta sem linha de Hub conta como bloqueada, não como ativa', () => {
  const conta = agrupar([grant('m1', 'videos', 'approved')])[0];
  assert.equal(estadoDaConta(conta), 'bloqueada', 'na dúvida, o acesso é negado');
});

test('sistema liberado não torna ativa uma conta sem Hub', () => {
  const conta = agrupar([grant('m1', 'hub', 'revoked'), grant('m1', 'videos', 'approved')])[0];
  assert.equal(estadoDaConta(conta), 'bloqueada', 'sem o Hub a pessoa não entra em lugar nenhum');
});

// ══════════════ Os botões de cada estado ══════════════

test('conta bloqueada oferece desbloquear, e não oferece bloquear de novo', () => {
  const acoes = acoesDoEstado('bloqueada');
  assert.match(acoes.principal, /Desbloquear/);
  assert.equal(acoes.podeBloquear, false, 'bloquear o que já está bloqueado é um botão que não faz nada');
});

test('conta ativa salva acessos e pode ser bloqueada', () => {
  const acoes = acoesDoEstado('ativa');
  assert.match(acoes.principal, /Salvar/);
  assert.equal(acoes.podeBloquear, true);
});

test('conta aguardando é aprovada', () => {
  const acoes = acoesDoEstado('aguardando');
  assert.match(acoes.principal, /Aprovar/);
  assert.equal(acoes.podeBloquear, true);
});

test('todo estado tem uma ação principal com nome do que vai acontecer', () => {
  for (const estado of ['ativa', 'aguardando', 'bloqueada']) {
    const acoes = acoesDoEstado(estado);
    assert.ok(acoes.principal.length > 5, `${estado} sem rótulo`);
  }
});

// ══════════════ Agrupamento ══════════════

test('a pessoa aparece uma vez só, mesmo com maiúsculas diferentes', () => {
  const contas = agrupar([
    grant('m1', 'hub', 'approved', 'KauaArtx'),
    grant('m1', 'videos', 'approved', 'kauaartx'),
    grant('m2', 'study', 'pending', ' KAUAARTX '),
  ]);
  assert.equal(contas.length, 1);
  assert.equal(contas[0].grants.length, 3);
});

test('ids repetidos da mesma pessoa não viram chamadas duplicadas', () => {
  const conta = agrupar([grant('m1', 'hub', 'approved'), grant('m1', 'videos', 'approved'), grant('m2', 'study', 'pending')])[0];
  assert.deepEqual(idsDaConta(conta).sort(), ['m1', 'm2']);
});

test('as contas mais novas aparecem primeiro', () => {
  const contas = agrupar([
    { memberId: 'a', app: 'hub', status: 'approved', member: pessoa('antiga', '2026-01-01') },
    { memberId: 'b', app: 'hub', status: 'approved', member: pessoa('nova', '2026-09-01') },
  ]);
  assert.deepEqual(contas.map(c => c.username), ['nova', 'antiga']);
});

test('contar selecionados ignora o que está desmarcado e a conta sem seleção', () => {
  const s = { kauaartx: { videos: true, study: false, university: true } };
  assert.equal(contarSelecionados(s, 'kauaartx'), 2);
  assert.equal(contarSelecionados(s, 'ninguem'), 0);
});
