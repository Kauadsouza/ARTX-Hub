import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DIAS_DE_VIDA,
  alternarDocumento,
  criarAnotacao,
  criarDocumento,
  diaLocal,
  diasRestantes,
  expirou,
  expurgar,
  ler,
  porUrgencia,
  progressoDocumentos,
  relatorioVazio,
  renovar,
  unir,
} from '../src/lib/relatorio.ts';

/** Meio-dia para os testes não dependerem do fuso em que rodam. */
const meioDia = (texto) => new Date(`${texto}T12:00:00`);

// ══════════════ A anotação nasce com prazo ══════════════

test('anotação nasce valendo sete dias', () => {
  const agora = meioDia('2026-09-21');
  const a = criarAnotacao('Comprar passagem', 'Ver preço na terça');
  assert.ok(a);
  const nascida = criarAnotacao('x', '', agora);
  assert.equal(nascida.expiraEm, '2026-09-28');
  assert.equal(diasRestantes(nascida, agora), DIAS_DE_VIDA);
  assert.equal(nascida.renovacoes, 0);
});

test('anotação sem título não é criada', () => {
  assert.equal(criarAnotacao('', 'tem descrição mas não tem nome'), null);
  assert.equal(criarAnotacao('   ', 'só espaços'), null);
});

test('título e descrição são aparados e limitados', () => {
  const a = criarAnotacao('  com espaços  ', '  e aqui também  ');
  assert.equal(a.titulo, 'com espaços');
  assert.equal(a.descricao, 'e aqui também');

  const gigante = criarAnotacao('t'.repeat(500), 'd'.repeat(9000));
  assert.equal(gigante.titulo.length, 200);
  assert.equal(gigante.descricao.length, 5000);
});

test('anotação pode não ter descrição nenhuma', () => {
  const a = criarAnotacao('só o título');
  assert.ok(a);
  assert.equal(a.descricao, '');
});

// ══════════════ O prazo conta dias de calendário ══════════════

test('a anotação vive o sétimo dia inteiro, não some no meio dele', () => {
  // Escrita às 23h: não pode morrer às 23h do sétimo dia.
  const noite = new Date('2026-09-21T23:30:00');
  const a = criarAnotacao('tarde da noite', '', noite);
  assert.equal(a.expiraEm, '2026-09-28');

  // De manhã cedo no dia de expirar, ainda está viva.
  assert.equal(expirou(a, new Date('2026-09-28T07:00:00')), false);
  // À noite do mesmo dia, ainda está viva.
  assert.equal(expirou(a, new Date('2026-09-28T23:59:00')), false);
  // No dia seguinte, sai.
  assert.equal(expirou(a, new Date('2026-09-29T00:01:00')), true);
});

test('o contador não conta horas: "vence hoje" é zero, não um', () => {
  const a = criarAnotacao('x', '', meioDia('2026-09-21'));
  assert.equal(diasRestantes(a, meioDia('2026-09-28')), 0);
  assert.equal(diasRestantes(a, new Date('2026-09-28T23:00:00')), 0);
  assert.equal(diasRestantes(a, meioDia('2026-09-27')), 1);
  assert.equal(diasRestantes(a, meioDia('2026-09-29')), -1);
});

test('a hora do dia não muda quantos dias faltam', () => {
  const a = criarAnotacao('x', '', new Date('2026-09-21T00:10:00'));
  const b = criarAnotacao('x', '', new Date('2026-09-21T23:50:00'));
  assert.equal(a.expiraEm, b.expiraEm);
});

// ══════════════ Nada some sem ter avisado ══════════════

test('expurgar tira só o que passou, e diz o que tirou', () => {
  const agora = meioDia('2026-09-21');
  const velha = criarAnotacao('já passou', '', meioDia('2026-09-01'));
  const nova = criarAnotacao('ainda vale', '', meioDia('2026-09-20'));

  const { relatorio, removidas } = expurgar({ ...relatorioVazio(), anotacoes: [velha, nova] }, agora);
  assert.equal(relatorio.anotacoes.length, 1);
  assert.equal(relatorio.anotacoes[0].titulo, 'ainda vale');
  assert.equal(removidas.length, 1);
  assert.equal(removidas[0].titulo, 'já passou');
});

test('expurgar sem nada vencido não mexe no relatório', () => {
  const agora = meioDia('2026-09-21');
  const original = { ...relatorioVazio(), anotacoes: [criarAnotacao('viva', '', agora)] };
  const { relatorio, removidas } = expurgar(original, agora);
  assert.equal(removidas.length, 0);
  assert.equal(relatorio, original, 'devia devolver o mesmo objeto, sem cópia à toa');
});

test('a anotação que vence hoje sobrevive ao expurgo de hoje', () => {
  const a = criarAnotacao('vence hoje', '', meioDia('2026-09-21'));
  const { removidas } = expurgar({ ...relatorioVazio(), anotacoes: [a] }, meioDia('2026-09-28'));
  assert.equal(removidas.length, 0, 'ela ainda tem o dia inteiro');
});

// ══════════════ Sete dias é padrão, não armadilha ══════════════

test('renovar devolve a semana inteira a partir de hoje', () => {
  const a = criarAnotacao('importante', '', meioDia('2026-09-21'));
  const renovada = renovar(a, meioDia('2026-09-27'));
  assert.equal(renovada.expiraEm, '2026-10-04');
  assert.equal(diasRestantes(renovada, meioDia('2026-09-27')), DIAS_DE_VIDA);
  assert.equal(renovada.renovacoes, 1);
  assert.equal(renovada.id, a.id, 'continua sendo a mesma anotação');
  assert.equal(renovada.criadaEm, a.criadaEm, 'a data em que foi escrita não muda');
});

test('renovar não altera a anotação original', () => {
  const a = criarAnotacao('x', '', meioDia('2026-09-21'));
  const antes = a.expiraEm;
  renovar(a, meioDia('2026-09-27'));
  assert.equal(a.expiraEm, antes);
});

test('as mais perto de vencer aparecem primeiro', () => {
  const agora = meioDia('2026-09-21');
  const lista = [
    criarAnotacao('folga', '', meioDia('2026-09-21')),
    criarAnotacao('aperto', '', meioDia('2026-09-15')),
    criarAnotacao('meio', '', meioDia('2026-09-18')),
  ];
  assert.deepEqual(
    porUrgencia(lista, agora).map((item) => item.titulo),
    ['aperto', 'meio', 'folga'],
  );
});

// ══════════════ Documentos ══════════════

test('documento nasce pendente e sem data', () => {
  const d = criarDocumento('Passaporte válido', 'mínimo 6 meses');
  assert.equal(d.feito, false);
  assert.equal(d.feitoEm, null);
  assert.equal(d.nota, 'mínimo 6 meses');
});

test('documento sem nome não é criado', () => {
  assert.equal(criarDocumento(''), null);
  assert.equal(criarDocumento('   '), null);
});

test('marcar guarda desde quando está pronto; desmarcar limpa', () => {
  const agora = meioDia('2026-09-21');
  const d = criarDocumento('Antecedentes criminais');
  const feito = alternarDocumento(d, agora);
  assert.equal(feito.feito, true);
  assert.equal(feito.feitoEm, agora.toISOString());

  const desfeito = alternarDocumento(feito, agora);
  assert.equal(desfeito.feito, false);
  assert.equal(desfeito.feitoEm, null, 'a data de um estado que não vale mais não fica para trás');
});

test('progresso conta certo, e lista vazia não divide por zero', () => {
  assert.deepEqual(progressoDocumentos([]), { feitos: 0, total: 0, fracao: 0 });

  const docs = [criarDocumento('a'), criarDocumento('b'), criarDocumento('c')];
  docs[0] = alternarDocumento(docs[0]);
  const p = progressoDocumentos(docs);
  assert.equal(p.feitos, 1);
  assert.equal(p.total, 3);
  assert.ok(Math.abs(p.fracao - 1 / 3) < 1e-9);
});

// ══════════════ Guardar e ler ══════════════

test('o relatório sobrevive à ida e volta pelo JSON', () => {
  const r = {
    version: 1,
    anotacoes: [criarAnotacao('nota', 'corpo')],
    documentos: [criarDocumento('doc', 'obs')],
  };
  assert.deepEqual(ler(JSON.stringify(r)), r);
});

test('lixo no armazenamento vira relatório vazio em vez de quebrar', () => {
  for (const entrada of [null, '', '{', '[]', '"texto"', '{"anotacoes":"não é lista"}', '{"outra":1}']) {
    const r = ler(entrada);
    assert.equal(r.anotacoes.length, 0);
    assert.equal(r.documentos.length, 0);
  }
});

test('item malformado é descartado sem levar os bons junto', () => {
  const bom = criarAnotacao('bom', '');
  const bruto = JSON.stringify({ anotacoes: [{ id: 'x' }, bom, null, 42], documentos: [{ nome: 'sem id' }] });
  const r = ler(bruto);
  assert.equal(r.anotacoes.length, 1);
  assert.equal(r.anotacoes[0].titulo, 'bom');
  assert.equal(r.documentos.length, 0);
});

test('importar soma sem sobrescrever o que já existe', () => {
  const doc = criarDocumento('Visto');
  const feitoAqui = alternarDocumento(doc);
  const atual = { version: 1, anotacoes: [], documentos: [feitoAqui] };

  // O arquivo tem o mesmo documento, ainda pendente, mais um novo.
  const importado = { version: 1, anotacoes: [criarAnotacao('do arquivo', '')], documentos: [doc, criarDocumento('NIE')] };

  const { relatorio, novas } = unir(atual, importado);
  assert.equal(novas, 2, 'entram a anotação e o documento novo');
  assert.equal(relatorio.documentos.length, 2);
  assert.equal(relatorio.documentos.find((item) => item.id === doc.id).feito, true, 'um arquivo antigo não desmarca o que já está pronto');
});

test('importar preenche um documento que aqui ainda estava pendente', () => {
  const doc = criarDocumento('Seguro saúde');
  const atual = { version: 1, anotacoes: [], documentos: [doc] };
  const importado = { version: 1, anotacoes: [], documentos: [alternarDocumento(doc)] };

  const { relatorio } = unir(atual, importado);
  assert.equal(relatorio.documentos.length, 1);
  assert.equal(relatorio.documentos[0].feito, true);
});

test('diaLocal usa o relógio daqui, não UTC', () => {
  // 21/09 às 23h em fuso negativo já seria 22/09 em UTC. O dia tem que ser o
  // que a pessoa vê no relógio dela.
  const d = new Date(2026, 8, 21, 23, 30);
  assert.equal(diaLocal(d), '2026-09-21');
});
