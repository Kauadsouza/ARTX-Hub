import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { scriptDoTema, temaPadrao, temaPorId, temas, validarEmail, validarNome, validarSenha } from '../src/lib/preferencias.ts';

/** Contraste WCAG entre duas cores em hex. */
function lum(hex) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contraste(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** As variáveis de base de cada tema, lidas do CSS de verdade — não de uma cópia. */
const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
function base(id) {
  const bloco = id === 'noite'
    ? css.slice(css.indexOf(':root[data-tema="noite"]'), css.indexOf(':root[data-tema="oceano"]'))
    : css.slice(css.indexOf(`:root[data-tema="${id}"]`), css.indexOf('}', css.indexOf(`:root[data-tema="${id}"]`)));
  const valor = nome => bloco.match(new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
  return { bg: valor('bg'), surface: valor('surface'), text: valor('text'), muted: valor('muted'), violet: valor('violet'), sobre: valor('sobre-acento') };
}

// ══════════════ Os temas são legíveis, não só bonitos ══════════════

test('existem pelo menos três temas', () => {
  assert.ok(temas.length >= 3);
});

test('todo tema listado na tela existe no CSS', () => {
  for (const tema of temas) {
    assert.ok(css.includes(`:root[data-tema="${tema.id}"]`), `${tema.nome} está na tela e não no CSS`);
  }
});

test('o texto principal é bem legível sobre o fundo e os cartões de todo tema', () => {
  for (const tema of temas) {
    const b = base(tema.id);
    for (const [onde, fundo] of [['fundo', b.bg], ['cartão', b.surface]]) {
      const razao = contraste(b.text, fundo);
      assert.ok(razao >= 7, `${tema.nome}: texto sobre ${onde} dá ${razao.toFixed(2)}:1`);
    }
  }
});

test('o texto secundário passa do mínimo de leitura em todo tema', () => {
  for (const tema of temas) {
    const b = base(tema.id);
    const razao = contraste(b.muted, b.surface);
    assert.ok(razao >= 4.5, `${tema.nome}: texto secundário dá ${razao.toFixed(2)}:1`);
  }
});

test('o texto do botão principal é legível sobre o acento de todo tema', () => {
  // É o elemento mais clicado do Hub. Em Oceano o acento é um ciano claro, e
  // por isso lá o texto é escuro — é para isso que `--sobre-acento` existe.
  for (const tema of temas) {
    const b = base(tema.id);
    const razao = contraste(b.sobre, b.violet);
    assert.ok(razao >= 4.5, `${tema.nome}: texto do botão dá ${razao.toFixed(2)}:1`);
  }
});

test('a amostra da tela bate com o acento do CSS', () => {
  // A miniatura mostra o acento; se divergir do CSS, a pessoa escolhe uma cor
  // e recebe outra.
  for (const tema of temas) {
    assert.equal(tema.amostra[2].toLowerCase(), base(tema.id).violet.toLowerCase(), tema.nome);
  }
});

test('identificador desconhecido cai no padrão em vez de quebrar', () => {
  assert.equal(temaPorId('inventado').id, temaPadrao.id);
  assert.equal(temaPorId(null).id, temaPadrao.id);
  assert.equal(temaPorId('claro').nome, 'Claro');
});

test('o script do <head> só aceita os temas que existem', () => {
  // Ele escreve no <html> antes de tudo; um valor qualquer do armazenamento
  // não pode virar atributo sem passar por uma lista fechada.
  for (const tema of temas) assert.ok(scriptDoTema.includes(`"${tema.id}"`), tema.id);
  assert.match(scriptDoTema, /^try\{/, 'um erro ali derrubaria a página inteira');
});

test('nenhuma cor fixa sobrou fora das definições de tema', () => {
  // Foi isso que impedia qualquer tema de existir: 453 cores escritas direto
  // nas regras. Se uma nova entrar escrita à mão, este teste avisa.
  for (const arquivo of ['globals.css', 'jade.css']) {
    const texto = readFileSync(new URL(`../src/app/${arquivo}`, import.meta.url), 'utf8');
    const corpo = texto.replace(/:root[^{]*\{[^}]*\}/g, '').replace(/url\([^)]*\)/g, '');
    const fixas = corpo.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) ?? [];
    assert.deepEqual(fixas, [], `${arquivo} tem cor escrita à mão`);
  }
});

// ══════════════ Validações da conta ══════════════

test('senha curta ou diferente é recusada, com o motivo certo', () => {
  assert.match(validarSenha('123', '123'), /oito|8/i);
  assert.match(validarSenha('12345678', '87654321'), /coincidem/i);
  assert.equal(validarSenha('12345678', '12345678'), null);
});

test('e-mail sem arroba ou sem domínio é recusado antes de ir ao servidor', () => {
  assert.ok(validarEmail(''));
  assert.ok(validarEmail('kaua'));
  assert.ok(validarEmail('kaua@'));
  assert.ok(validarEmail('kaua@gmail'), 'domínio sem ponto não é endereço completo');
  assert.equal(validarEmail('kauaartx@gmail.com'), null);
  assert.equal(validarEmail('  kauaartx@gmail.com  '), null, 'espaço em volta não é erro de digitação do domínio');
});

test('nome muito curto ou longo demais é recusado', () => {
  assert.ok(validarNome('K'));
  assert.ok(validarNome(' '));
  assert.ok(validarNome('a'.repeat(61)));
  assert.equal(validarNome('Kauã'), null);
  assert.equal(validarNome('  Kauã  '), null);
});
