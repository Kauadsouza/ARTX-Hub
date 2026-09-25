import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  acoesDoEstado,
  agrupar,
  contarSelecionados,
  estadoDaConta,
  idsDaConta,
  podeAplicar,
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

test('são os sistemas que decidem o estado, em qualquer combinação', () => {
  // A regra mudou junto com o modelo: ninguém entra pelo Hub, então o estado
  // da pessoa é o dos sistemas que ela pediu.
  const de = (...concessoes) => estadoDaConta(agrupar(concessoes)[0]);
  assert.equal(de(grant('m1', 'videos', 'approved')), 'ativa');
  assert.equal(de(grant('m1', 'videos', 'pending')), 'aguardando');
  assert.equal(de(grant('m1', 'videos', 'revoked')), 'bloqueada');
  // Um liberado basta, mesmo com outros negados.
  assert.equal(de(grant('m1', 'videos', 'approved'), grant('m1', 'study', 'revoked')), 'ativa');
});

test('conta sem nenhuma concessão de sistema é bloqueada', () => {
  const conta = agrupar([grant('m1', 'hub', 'approved')])[0];
  assert.equal(estadoDaConta(conta), 'bloqueada', 'na dúvida, o acesso é negado');
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

// ══════════════ O modelo de conta chefe ══════════════

test('quem pediu só um sistema e foi liberado aparece como ativa, não bloqueada', async () => {
  // Pela regra antiga o Hub era o interruptor geral. Quem cria conta dentro do
  // Vídeos não tem linha de Hub nenhuma, e aparecia bloqueado com o acesso
  // funcionando.
  const conta = agrupar([grant('m1', 'videos', 'approved')])[0];
  assert.equal(estadoDaConta(conta), 'ativa');
});

test('nada liberado mas algo esperando conta como aguardando', () => {
  const conta = agrupar([grant('m1', 'videos', 'pending'), grant('m1', 'study', 'revoked')])[0];
  assert.equal(estadoDaConta(conta), 'aguardando');
});

test('tudo revogado é bloqueada', () => {
  const conta = agrupar([grant('m1', 'videos', 'revoked'), grant('m1', 'study', 'revoked')])[0];
  assert.equal(estadoDaConta(conta), 'bloqueada');
});

test('o acesso ao Hub não torna a conta ativa: o Hub é o painel do dono', () => {
  const conta = agrupar([grant('m1', 'hub', 'approved'), grant('m1', 'videos', 'revoked')])[0];
  assert.equal(estadoDaConta(conta), 'bloqueada', 'o estado vem dos sistemas, não do Hub');
});

test('"não pediu" é diferente de "negado"', async () => {
  const { estadoDoSistema } = await import('../src/lib/aprovacoes.ts');
  const conta = agrupar([grant('m1', 'videos', 'approved'), grant('m1', 'study', 'revoked')])[0];
  assert.equal(estadoDoSistema(conta, 'videos'), 'liberado');
  assert.equal(estadoDoSistema(conta, 'study'), 'negado');
  assert.equal(estadoDoSistema(conta, 'university'), 'nao-pediu', 'ausência de pedido não é uma decisão');
});

test('cada estado de sistema tem rótulo', async () => {
  const { rotuloDoSistema } = await import('../src/lib/aprovacoes.ts');
  for (const estado of ['liberado', 'esperando', 'negado', 'nao-pediu']) {
    assert.ok(rotuloDoSistema[estado].length > 3, `${estado} sem rótulo`);
  }
});

test('a última decisão é a mais recente entre as concessões', async () => {
  const { decididoEm } = await import('../src/lib/aprovacoes.ts');
  const conta = agrupar([
    { ...grant('m1', 'videos', 'approved'), updatedAt: '2026-09-10T00:00:00Z' },
    { ...grant('m1', 'study', 'revoked'), updatedAt: '2026-09-20T00:00:00Z' },
  ])[0];
  assert.equal(decididoEm(conta), '2026-09-20T00:00:00Z');
});

test('sem data de decisão, a ficha não inventa uma', async () => {
  const { decididoEm } = await import('../src/lib/aprovacoes.ts');
  assert.equal(decididoEm(agrupar([grant('m1', 'videos', 'pending')])[0]), null);
});

// ══════════════ O defeito que fazia "Aprovar conta" revogar tudo ══════════════

test('o sistema pedido já vem marcado, para que aprovar signifique aprovar', () => {
  // Antes só `approved` vinha marcado. Uma conta nova abria com tudo vazio, e o
  // botão dela dizia "Aprovar conta" — clicar mandava seleção vazia, que
  // significa "retire tudo". O dono aprovava e revogava o que a pessoa pediu.
  const s = selecoesDoServidor([grant('m1', 'cursos', 'pending')]);
  assert.equal(s.kauaartx.cursos, true, 'o pedido precisa vir marcado');
});

test('negado continua desmarcado: aprovar não ressuscita o que foi recusado', () => {
  const s = selecoesDoServidor([grant('m1', 'cursos', 'revoked'), grant('m1', 'videos', 'pending')]);
  assert.equal(s.kauaartx.cursos, false);
  assert.equal(s.kauaartx.videos, true);
});

test('numa conta aguardando, seleção vazia é recusada em vez de virar revogação', () => {
  const r = podeAplicar('aguardando', 0);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /Bloquear conta/, 'precisa dizer por onde se nega o pedido');
});

test('numa conta bloqueada, desbloquear sem marcar nada também é recusado', () => {
  assert.equal(podeAplicar('bloqueada', 0).ok, false);
});

test('numa conta ativa, seleção vazia continua valendo: é como se retira tudo', () => {
  assert.equal(podeAplicar('ativa', 0).ok, true);
});

test('com algum sistema marcado, qualquer estado pode aplicar', () => {
  for (const estado of ['ativa', 'aguardando', 'bloqueada']) {
    assert.equal(podeAplicar(estado, 1).ok, true, estado);
  }
});

test('o caminho completo do bug: conta nova, aprovar, e o acesso sai liberado', () => {
  const linhas = [grant('m1', 'cursos', 'pending')];
  const conta = agrupar(linhas)[0];
  const selecoes = selecoesDoServidor(linhas);

  assert.equal(estadoDaConta(conta), 'aguardando');
  assert.equal(acoesDoEstado(estadoDaConta(conta)).principal, 'Aprovar conta');

  // O que o botão manda para o servidor.
  const escolhidos = Object.entries(selecoes[conta.key]).filter(([, marcado]) => marcado).map(([app]) => app);
  assert.equal(podeAplicar(estadoDaConta(conta), escolhidos.length).ok, true);
  assert.deepEqual(escolhidos, ['cursos'], 'aprovar tem que liberar justamente o que foi pedido');
});
