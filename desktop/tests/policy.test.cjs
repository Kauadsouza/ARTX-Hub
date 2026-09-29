'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../src/policy.cjs');

test('host confusion, credentials, local files and insecure navigation are rejected', () => {
  for (const url of ['https://artx-hub.vercel.app.evil.test/', 'https://artx-hub.vercel.app@evil.test/', 'https://owner:secret@artx-hub.vercel.app/', 'http://artx-hub.vercel.app/', 'file:///C:/Windows/system.ini', 'javascript:alert(1)', 'data:text/html,bad', 'http://127.0.0.1:7777/']) {
    assert.equal(p.canNavigate(url, true), false, url);
    assert.equal(p.canNavigate(url, false), false, url);
  }
  assert.equal(p.canNavigate(p.HUB_URL, true), true);
  assert.equal(p.canNavigate('https://sat-simulado.vercel.app/', false), true);
  assert.equal(p.canNavigate('https://sat-simulado.vercel.app/', true), false);
});
test('external dispatch cannot pass commands or parameters to local protocols', () => {
  // Nenhum protocolo próprio de aplicativo passa, seja qual for o esquema.
  // O teste guarda a ausência de exceções na lista de permissão.
  for (const url of ['app://open', 'app://open?command=delete', 'meuapp://x', 'cmd:/c calc', 'powershell:bad', 'file:///C:/bad.exe', 'ms-msdt:/bad', 'javascript:bad', 'https://user:secret@example.com']) assert.equal(p.externalTarget(url), null);
  assert.equal(p.externalTarget('https://www.ox.ac.uk/'), 'https://www.ox.ac.uk/');
});
test('exports must originate from the workspace', () => {
  assert.equal(p.canDownload('blob:https://artx-hub.vercel.app/123'), true);
  assert.equal(p.canDownload('blob:https://evil.test/123'), false);
  assert.equal(p.canDownload('file:///C:/private.txt'), false);
});
test('only audio practice can request a device permission', () => {
  assert.equal(p.canRequestAudio('media', 'https://sat-simulado.vercel.app/practice', ['audio']), true);
  for (const types of [[], ['video'], ['audio', 'video'], undefined]) assert.equal(p.canRequestAudio('media', p.STUDY_ORIGIN, types), false);
  assert.equal(p.canRequestAudio('media', p.HUB_URL, ['audio']), false);
  assert.equal(p.canRequestAudio('geolocation', p.STUDY_ORIGIN, ['audio']), false);
});

test('os Cursos abrem num quadro e podem baixar o certificado', () => {
  assert.equal(p.canNavigate('https://cursos-artx.vercel.app/', false), true);
  assert.equal(p.canNavigate('https://cursos-artx.vercel.app/', true), false, 'nunca vira a janela principal');
  assert.equal(p.canDownload('blob:https://cursos-artx.vercel.app/8b1d'), true);
});

test('o player do YouTube e a calculadora entram só como quadro', () => {
  for (const url of ['https://www.youtube-nocookie.com/embed/UuIEbpQms8o', 'https://www.desmos.com/calculator']) {
    assert.equal(p.canNavigate(url, false), true, url);
    assert.equal(p.canNavigate(url, true), false, url);
    assert.equal(p.canDownload(url), false, url);
  }
  assert.equal(p.canNavigate('https://www.youtube.com/watch?v=x', false), false, 'o YouTube com rastreio continua de fora');
  assert.equal(p.canNavigate('http://www.youtube-nocookie.com/embed/x', false), false, 'sem HTTPS, não');
});
