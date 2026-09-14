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
  for (const url of ['condor://open?command=delete', 'condor://open/other', 'cmd:/c calc', 'powershell:bad', 'file:///C:/bad.exe', 'ms-msdt:/bad', 'javascript:bad', 'https://user:secret@example.com']) assert.equal(p.externalTarget(url), null);
  assert.equal(p.externalTarget('condor://open'), 'condor://open');
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
