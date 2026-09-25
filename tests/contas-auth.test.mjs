import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  SISTEMAS,
  SISTEMAS_DE_PESSOA,
  hashPassword,
  matchesPassword,
  memberIdentity,
  requireHubOwner,
  sistema,
} from '../src/lib/contas-auth.ts';
import { prisma } from '../src/lib/prisma.ts';

/*
  Estes testes vieram do sistema de vídeos junto com o código.

  O serviço de contas morava lá dentro, e todos os outros sistemas batiam nele
  para deixar alguém entrar — o que amarrava sistemas que não têm nada a ver um
  com o outro e fazia o de vídeos virar ponto único de falha. O serviço é do
  Hub, que é o único ponto que centraliza, e os testes acompanham.
*/

test('senha guardada é hash com sal, não dá para voltar, e compara certo', async () => {
  const senha = 'test-only-password-42';
  const primeiro = await hashPassword(senha);
  const segundo = await hashPassword(senha);
  assert.notEqual(primeiro, segundo, 'o sal tem que mudar a cada vez');
  assert.ok(!primeiro.includes(senha), 'a senha não pode aparecer no que é guardado');
  assert.equal(await matchesPassword(senha, primeiro), true);
  assert.equal(await matchesPassword('incorrect-password', primeiro), false);
});

test('nome de sistema inventado nunca seleciona um espaço', () => {
  assert.equal(sistema('hub'), 'hub');
  assert.equal(sistema('study'), 'study');
  assert.equal(sistema('cursos'), 'cursos');
  assert.throws(() => sistema('owner'));
  assert.throws(() => sistema('../admin'));
});

test('o Hub não é um sistema que se pede: ele é só do dono', () => {
  assert.ok(SISTEMAS.includes('hub'));
  assert.ok(!SISTEMAS_DE_PESSOA.includes('hub'), 'ninguém pode pedir acesso ao Hub');
});

test('sessão recusa token ausente, expirado e de outro sistema; a aprovação é reconferida', async () => {
  const sessaoOriginal = prisma.memberSession.findUnique;
  const grantOriginal = prisma.memberGrant.findUnique;
  const token = 'a'.repeat(64);
  try {
    await assert.rejects(memberIdentity(undefined, 'videos'));

    prisma.memberSession.findUnique = async () => ({ digest: 'x', principal: 'account-a', app: 'videos', expiresAt: new Date(Date.now() + 10000) });
    prisma.memberGrant.findUnique = async () => ({ memberId: 'account-a', app: 'videos', status: 'approved', updatedAt: new Date() });
    assert.equal(await memberIdentity(token, 'videos'), 'account-a');

    // Token do sistema de vídeos não vale no de idiomas.
    await assert.rejects(memberIdentity(token, 'study'));

    // Revogar no Hub tem efeito na hora, não só no próximo login.
    for (const status of ['pending', 'rejected', 'revoked']) {
      prisma.memberGrant.findUnique = async () => ({ memberId: 'account-a', app: 'videos', status, updatedAt: new Date() });
      await assert.rejects(memberIdentity(token, 'videos'));
    }

    prisma.memberSession.findUnique = async () => ({ digest: 'x', principal: 'owner', app: 'videos', expiresAt: new Date(0) });
    await assert.rejects(memberIdentity(token, 'videos'), 'sessão vencida não vale nem para o dono');
  } finally {
    prisma.memberSession.findUnique = sessaoOriginal;
    prisma.memberGrant.findUnique = grantOriginal;
  }
});

test('ser dono é confirmado no provedor, não na palavra do navegador', async () => {
  const fetchAntes = globalThis.fetch;
  const antes = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    email: process.env.HUB_ALLOWED_EMAIL,
  };
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.invalid';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-key';
    process.env.HUB_ALLOWED_EMAIL = 'owner@example.test';

    globalThis.fetch = async () => Response.json({ id: 'another-account', email: 'someone@example.test' });
    await assert.rejects(requireHubOwner('test-token'), 'outro e-mail não administra');

    globalThis.fetch = async () => Response.json({ id: 'verified-owner', email: 'owner@example.test' });
    assert.equal(await requireHubOwner('test-token'), 'verified-owner');

    globalThis.fetch = async () => new Response(null, { status: 401 });
    await assert.rejects(requireHubOwner('test-token'));
  } finally {
    globalThis.fetch = fetchAntes;
    for (const [chave, valor] of Object.entries({
      NEXT_PUBLIC_SUPABASE_URL: antes.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: antes.key,
      HUB_ALLOWED_EMAIL: antes.email,
    })) {
      if (valor === undefined) delete process.env[chave];
      else process.env[chave] = valor;
    }
  }
});

test('nenhuma conta enxerga o estado de outra', () => {
  const rota = readFileSync(new URL('../src/app/api/contas/route.ts', import.meta.url), 'utf8');
  assert.match(rota, /principal_app: \{ principal, app \}/, 'ler estado é sempre do próprio principal');
  assert.match(rota, /where: \{ principal, app, revision \}/, 'gravar também');
  assert.match(rota, /select: \{ app: true, status: true, memberId: true, updatedAt: true, member: \{ select: \{ username: true, createdAt: true \} \} \}/);
  assert.doesNotMatch(rota, /admin-list[\s\S]{0,500}payload: true/, 'a lista do dono não carrega o conteúdo de ninguém');
});

test('a lista de origens é fechada e não tem curinga', () => {
  const rota = readFileSync(new URL('../src/app/api/contas/route.ts', import.meta.url), 'utf8');
  const bloco = rota.slice(rota.indexOf('const permitidas'), rota.indexOf('function cabecalhos'));
  assert.doesNotMatch(bloco, /\*/, 'nada de origem curinga');
  for (const sistema of ['artx-hub', 'sistema-videos', 'sat-simulado', 'university-path', 'cursos-artx']) {
    assert.ok(bloco.includes(sistema), `${sistema} precisa poder pedir login`);
  }
});
