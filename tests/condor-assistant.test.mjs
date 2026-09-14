import { test } from 'node:test';
import assert from 'node:assert/strict';

function request(body, headers = {}) {
  return new Request('http://localhost/api/condor-assistant', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

test('rejects non-JSON content types', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const { POST } = await import('../src/app/api/condor-assistant/route.ts');
  const response = await POST(new Request('http://localhost/api/condor-assistant', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'x' }));
  assert.equal(response.status, 415);
});

test('reports not_configured without breaking the rest of the Hub when no API key is set', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const { POST } = await import('../src/app/api/condor-assistant/route.ts');
  const response = await POST(request({ accessToken: 'x', messages: [{ role: 'user', content: 'oi' }] }));
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.error, 'not_configured');
});

test('rejects malformed message payloads once configured', async () => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-public-key';
  const { POST } = await import('../src/app/api/condor-assistant/route.ts');
  const missingToken = await POST(request({ messages: [{ role: 'user', content: 'oi' }] }));
  assert.equal(missingToken.status, 401);
  const emptyMessages = await POST(request({ accessToken: 'x', messages: [] }));
  assert.equal(emptyMessages.status, 400);
  const tooMany = await POST(request({ accessToken: 'x', messages: Array.from({ length: 21 }, () => ({ role: 'user', content: 'oi' })) }));
  assert.equal(tooMany.status, 400);
  const badRole = await POST(request({ accessToken: 'x', messages: [{ role: 'system', content: 'oi' }] }));
  assert.equal(badRole.status, 400);
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
});
