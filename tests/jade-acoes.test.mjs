import { test } from 'node:test';
import assert from 'node:assert/strict';

import { descreverAcao, destinos, instrucoesDeAcao, pedeConfirmacao, separarAcao, validarAcao } from '../src/lib/jade-acoes.ts';

// ══════════════ O texto e o comando não se contaminam ══════════════

test('sem bloco, o texto passa inteiro e nada é executado', () => {
  const r = separarAcao('Sugiro começar pelo passaporte.');
  assert.equal(r.texto, 'Sugiro começar pelo passaporte.');
  assert.equal(r.acao, null);
});

test('com bloco, o texto sai limpo e a ação vem separada', () => {
  const r = separarAcao('Criei para você.\n<<ACAO>>{"tipo":"criar-atividade","titulo":"Comprar passagem"}<</ACAO>>');
  assert.equal(r.texto, 'Criei para você.', 'o marcador não pode vazar para a tela');
  assert.deepEqual(r.acao, { tipo: 'criar-atividade', titulo: 'Comprar passagem', projeto: null });
});

test('bloco malformado é descartado, e a resposta em texto continua valendo', () => {
  const r = separarAcao('Feito.\n<<ACAO>>{isso não é json}<</ACAO>>');
  assert.equal(r.texto, 'Feito.');
  assert.equal(r.acao, null, 'errar a execução é pior que não executar');
});

// ══════════════ Só passa o que a lista conhece ══════════════

test('tipo inventado não vira ação', () => {
  assert.equal(validarAcao({ tipo: 'apagar-tudo', alvo: 'notas' }), null);
  assert.equal(validarAcao({ tipo: 'executar', comando: 'rm -rf' }), null);
  assert.equal(validarAcao({}), null);
});

test('campo obrigatório faltando ou vazio não vira ação', () => {
  assert.equal(validarAcao({ tipo: 'criar-atividade' }), null);
  assert.equal(validarAcao({ tipo: 'criar-atividade', titulo: '   ' }), null);
  assert.equal(validarAcao({ tipo: 'criar-nota', conteudo: '' }), null);
  assert.equal(validarAcao({ tipo: 'concluir-atividade', titulo: 42 }), null);
});

test('a Jade não navega para onde quiser: destino fora do mapa não abre', () => {
  assert.equal(validarAcao({ tipo: 'abrir', destino: 'banco-de-dados' }), null);
  assert.equal(validarAcao({ tipo: 'abrir', destino: 'https://exemplo.com' }), null);
  assert.deepEqual(validarAcao({ tipo: 'abrir', destino: 'relatorio' }), { tipo: 'abrir', destino: 'relatorio' });
});

test('texto gigante é cortado em vez de passar inteiro', () => {
  const acao = validarAcao({ tipo: 'criar-nota', conteudo: 'x'.repeat(9000) });
  assert.equal(acao.conteudo.length, 5000);
});

// ══════════════ O que pede confirmação ══════════════

test('concluir pede confirmação; criar e abrir não', () => {
  assert.equal(pedeConfirmacao({ tipo: 'concluir-atividade', titulo: 'x' }), true, 'desfazer isso é trabalho dele');
  assert.equal(pedeConfirmacao({ tipo: 'criar-atividade', titulo: 'x', projeto: null }), false);
  assert.equal(pedeConfirmacao({ tipo: 'criar-nota', conteudo: 'x' }), false);
  assert.equal(pedeConfirmacao({ tipo: 'abrir', destino: 'relatorio' }), false);
});

test('a confirmação diz o efeito, não o nome do comando', () => {
  const frase = descreverAcao({ tipo: 'concluir-atividade', titulo: 'Ligar pro consulado' });
  assert.match(frase, /Ligar pro consulado/);
  assert.ok(!/concluir-atividade/.test(frase), 'o nome interno do comando não serve para quem lê');
});

test('toda ação tem uma frase de confirmação', () => {
  const todas = [
    { tipo: 'criar-atividade', titulo: 'a', projeto: null },
    { tipo: 'criar-nota', conteudo: 'b' },
    { tipo: 'concluir-atividade', titulo: 'c' },
    { tipo: 'abrir', destino: 'relatorio' },
  ];
  for (const acao of todas) assert.ok(descreverAcao(acao).length > 8, `${acao.tipo} sem frase`);
});

// ══════════════ O prompt e o código não se desencontram ══════════════

test('todo destino ensinado no prompt existe no mapa', () => {
  const linha = instrucoesDeAcao.match(/"destino":"([^"]+)"/)[1];
  for (const destino of linha.split('|')) {
    assert.ok(destino in destinos, `o prompt ensina "${destino}", que o código não reconhece`);
  }
});

test('todo tipo ensinado no prompt é aceito pela validação', () => {
  const tipos = [...instrucoesDeAcao.matchAll(/"tipo":"([a-z-]+)"/g)].map(m => m[1]);
  assert.ok(tipos.length >= 4);
  const exemplo = { 'criar-atividade': { titulo: 'x' }, 'criar-nota': { conteudo: 'x' }, 'concluir-atividade': { titulo: 'x' }, abrir: { destino: 'relatorio' } };
  for (const tipo of tipos) {
    assert.ok(validarAcao({ tipo, ...exemplo[tipo] }), `o prompt ensina "${tipo}", que a validação recusa`);
  }
});
