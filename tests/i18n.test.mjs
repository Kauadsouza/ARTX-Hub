import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { varrer } from '../scripts/i18n-textos.mjs';
import { ROTULO_ETAPA } from '../src/lib/painel.ts';
import { temas, validarEmail, validarNome, validarSenha } from '../src/lib/preferencias.ts';
import { acoesDoEstado, rotuloDoSistema } from '../src/lib/aprovacoes.ts';
import { grupos, semente } from '../src/lib/espanha.ts';
import { projectLabel } from '../src/lib/week-ahead.ts';

const catalogo = JSON.parse(readFileSync(new URL('../src/lib/en.json', import.meta.url), 'utf8'));
const { chaves } = varrer();

/*
  O inglês falhava em silêncio: uma frase sem entrada no catálogo aparece em
  português com a tela em inglês, e ninguém percebe até abrir aquela tela.
  Estes testes cobram a entrada no momento em que a frase nasce.
*/

test('toda frase passada ao tradutor tem inglês', () => {
  const faltando = [...chaves].filter(([chave]) => !(chave in catalogo)).map(([chave, onde]) => `${onde}  ${chave}`);
  assert.deepEqual(faltando, [], `frases sem inglês em src/lib/en.json:\n${faltando.join('\n')}`);
});

test('os textos que chegam ao tradutor por variável também têm inglês', () => {
  const textos = [
    ...Object.values(ROTULO_ETAPA),
    ...temas.flatMap((tema) => [tema.nome, tema.descricao]),
    ...Object.values(rotuloDoSistema),
    ...['ativa', 'aguardando', 'bloqueada'].map((estado) => acoesDoEstado(estado).principal),
    ...grupos.flatMap((grupo) => [grupo.titulo, grupo.resumo, ...grupo.depende]),
    ...semente.map((item) => item.nome),
    ...['geral', 'sat', 'videos', 'site', 'university', 'jade'].map(projectLabel),
    validarSenha('curta', 'curta'),
    validarSenha('longa-o-bastante', 'outra-coisa'),
    validarEmail(''),
    validarEmail('sem-arroba'),
    validarNome('a'),
    validarNome('x'.repeat(61)),
  ];
  const faltando = textos.filter((texto) => !(texto in catalogo));
  assert.deepEqual(faltando, []);
});

test('a tradução leva os mesmos {n} que o original', () => {
  const marcas = (texto) => [...texto.matchAll(/\{(\d+)\}/g)].map((m) => m[1]).sort().join(',');
  const errados = Object.entries(catalogo).filter(([pt, en]) => marcas(pt) !== marcas(en));
  assert.deepEqual(errados, []);
});

test('o catálogo não guarda frase que nenhuma tela usa mais', () => {
  const { soltos } = varrer();
  const noCodigo = new Set([...chaves.keys(), ...soltos.map((item) => item.texto)]);
  const fonte = [
    'src/components/Hub.tsx', 'src/components/Configuracoes.tsx', 'src/components/AccountApprovals.tsx',
    'src/components/PersonalDashboard.tsx', 'src/components/JadeCanto.tsx', 'src/lib/painel.ts',
    'src/lib/preferencias.ts', 'src/lib/aprovacoes.ts', 'src/lib/espanha.ts', 'src/lib/week-ahead.ts',
    'src/lib/relatorio.ts', 'src/lib/relatorio-espelho.ts', 'src/lib/avatar.ts', 'src/lib/anexos.ts',
    'src/lib/anexos-cofre.ts', 'src/lib/contas-auth.ts', 'src/app/api/contas/route.ts',
    'src/app/api/painel/route.ts', 'src/app/api/jade-assistant/route.ts',
  ].map((arquivo) => readFileSync(new URL(`../${arquivo}`, import.meta.url), 'utf8')).join('\n');
  const orfas = Object.keys(catalogo).filter((pt) => !noCodigo.has(pt) && !fonte.includes(pt));
  assert.deepEqual(orfas, [], `entradas sem uso em src/lib/en.json:\n${orfas.join('\n')}`);
});
