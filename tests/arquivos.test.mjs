import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LIMITE_BYTES, formatoDe, nomeSeguro } from '../src/lib/arquivos.ts';

const pdf = (extra = 'conteúdo') => Buffer.concat([Buffer.from([0x25, 0x50, 0x44, 0x46]), Buffer.from(extra)]);
const png = () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const jpg = () => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const webp = () => Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);

test('reconhece os quatro formatos aceitos', () => {
  assert.equal(formatoDe(pdf())?.tipo, 'application/pdf');
  assert.equal(formatoDe(png())?.tipo, 'image/png');
  assert.equal(formatoDe(jpg())?.tipo, 'image/jpeg');
  assert.equal(formatoDe(webp())?.tipo, 'image/webp');
});

test('a extensão vem do formato real, não do nome enviado', () => {
  assert.equal(nomeSeguro('foto.jpeg', formatoDe(pdf()).extensao), 'foto.pdf');
});

test('executável renomeado para .pdf não passa', () => {
  // MZ — cabeçalho de executável do Windows.
  const disfarcado = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]);
  assert.equal(formatoDe(disfarcado), null);
});

test('arquivo que só começa como RIFF não é WEBP', () => {
  // WAV também é RIFF. Sem os bytes 8..11 dizendo WEBP, não entra.
  const wav = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]);
  assert.equal(formatoDe(wav), null);
});

test('arquivo curto demais não explode nem é aceito por acaso', () => {
  assert.equal(formatoDe(Buffer.from([])), null);
  assert.equal(formatoDe(Buffer.from([0x25, 0x50])), null);
  assert.equal(formatoDe(Buffer.from([0x52, 0x49, 0x46, 0x46])), null, 'RIFF sozinho não diz nada');
});

test('texto que não começa com uma assinatura conhecida não passa', () => {
  assert.equal(formatoDe(Buffer.from('um texto qualquer')), null);
  assert.equal(formatoDe(Buffer.from('<html><body>oi</body></html>')), null);
  // Escrever "PDF" no meio não faz diferença: a assinatura é o começo.
  assert.equal(formatoDe(Buffer.from('isto menciona %PDF mas não é um')), null);
});

test('o nome perde caminho, para não escapar da pasta', () => {
  assert.equal(nomeSeguro('../../etc/senha.pdf', 'pdf'), 'senha.pdf');
  assert.equal(nomeSeguro('C:\\Users\\kaua\\cert.pdf', 'pdf'), 'cert.pdf');
});

test('o nome perde caractere de controle e aspas', () => {
  assert.equal(nomeSeguro('cert"; rm -rf.pdf', 'pdf'), 'cert rm -rf.pdf');
  assert.ok(!nomeSeguro('a\u0000b.pdf', 'pdf').includes('\u0000'));
});

test('o nome mantém acento, que é nome de verdade e não ameaça', () => {
  assert.equal(nomeSeguro('Certificação CS50.pdf', 'pdf'), 'Certificação CS50.pdf');
});

test('nome vazio ainda vira um arquivo com nome', () => {
  assert.equal(nomeSeguro('', 'pdf'), 'certificado.pdf');
  assert.equal(nomeSeguro('.....', 'pdf'), 'certificado.pdf');
});

test('nome gigante é cortado, não recusado', () => {
  const nome = nomeSeguro('a'.repeat(500) + '.pdf', 'pdf');
  assert.ok(nome.length <= 84, nome.length);
  assert.ok(nome.endsWith('.pdf'));
});

test('o limite de tamanho é explícito e cabe num certificado', () => {
  assert.ok(LIMITE_BYTES > 500_000, 'um PDF de certificado passa');
  assert.ok(LIMITE_BYTES < 2_000_000, 'e cabe no teto do pedido, que já é 2 MB');
});
