import { test } from 'node:test';
import assert from 'node:assert/strict';

import { acentos, acentoPadrao, acentoPorId, validarEmail, validarNome, validarSenha } from '../src/lib/preferencias.ts';

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

// ══════════════ As cores são legíveis, não só bonitas ══════════════

test('texto branco é legível sobre toda cor de destaque', () => {
  // O botão principal é branco sobre a cor cheia. É o elemento mais clicado do
  // Hub, e o violeta original reprovava em 3,69:1.
  for (const acento of acentos) {
    const razao = contraste('#ffffff', acento.cor);
    assert.ok(razao >= 4.5, `${acento.nome} dá ${razao.toFixed(2)}:1 — abaixo do mínimo de leitura`);
  }
});

test('a versão clara é de fato mais clara que a cheia', () => {
  for (const acento of acentos) {
    assert.ok(lum(acento.clara) > lum(acento.cor), `${acento.nome}: a cor de hover não clareou`);
  }
});

test('toda cor tem as três variáveis, e a suave é transparente', () => {
  for (const acento of acentos) {
    assert.match(acento.cor, /^#[0-9a-f]{6}$/i, `${acento.nome} sem cor cheia`);
    assert.match(acento.clara, /^#[0-9a-f]{6}$/i, `${acento.nome} sem versão clara`);
    assert.match(acento.suave, /^rgba\(/, `${acento.nome}: a suave precisa ser transparente para servir de fundo`);
  }
});

test('os identificadores não se repetem', () => {
  assert.equal(new Set(acentos.map(a => a.id)).size, acentos.length);
});

test('identificador desconhecido cai no padrão em vez de quebrar', () => {
  assert.equal(acentoPorId('inventado').id, acentoPadrao.id);
  assert.equal(acentoPorId(null).id, acentoPadrao.id);
  assert.equal(acentoPorId('verde').nome, 'Verde');
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
