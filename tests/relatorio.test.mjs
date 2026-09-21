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
    ...relatorioVazio(),
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
  const atual = { ...relatorioVazio(), documentos: [feitoAqui] };

  // O arquivo tem o mesmo documento, ainda pendente, mais um novo.
  const importado = { ...relatorioVazio(), anotacoes: [criarAnotacao('do arquivo', '')], documentos: [doc, criarDocumento('NIE')] };

  const { relatorio, novas } = unir(atual, importado);
  assert.equal(novas, 2, 'entram a anotação e o documento novo');
  assert.equal(relatorio.documentos.length, 2);
  assert.equal(relatorio.documentos.find((item) => item.id === doc.id).feito, true, 'um arquivo antigo não desmarca o que já está pronto');
});

test('importar preenche um documento que aqui ainda estava pendente', () => {
  const doc = criarDocumento('Seguro saúde');
  const atual = { ...relatorioVazio(), documentos: [doc] };
  const importado = { ...relatorioVazio(), documentos: [alternarDocumento(doc)] };

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

// ══════════════ A lista da Espanha ══════════════

test('semear enche a lista uma vez e não repete na segunda', async () => {
  const { semear, relatorioVazio } = await import('../src/lib/relatorio.ts');
  const { semente } = await import('../src/lib/espanha.ts');

  const primeira = semear(relatorioVazio());
  assert.equal(primeira.adicionados, semente.length);
  assert.equal(primeira.relatorio.documentos.length, semente.length);

  const segunda = semear(primeira.relatorio);
  assert.equal(segunda.adicionados, 0);
  assert.equal(segunda.relatorio, primeira.relatorio, 'nada a fazer devia devolver o mesmo objeto');
});

test('todo visto tem documentação própria, e cada grupo tem itens', async () => {
  const { semear, relatorioVazio, documentosDoGrupo } = await import('../src/lib/relatorio.ts');
  const { relatorio } = semear(relatorioVazio());
  for (const grupo of ['base', 'apostila', 'estudante', 'trabalho', 'nomade']) {
    assert.ok(documentosDoGrupo(relatorio, grupo).length > 0, `${grupo} ficou sem documento`);
  }
});

test('o mesmo documento em vistos diferentes são itens separados', async () => {
  const { semear, relatorioVazio, documentosDoGrupo } = await import('../src/lib/relatorio.ts');
  const { relatorio } = semear(relatorioVazio());
  // "Passaporte válido" aparece nos três vistos. Marcar no de trabalho não
  // pode marcar no de estudante: são pedidos diferentes, em momentos diferentes.
  const nos = ['estudante', 'trabalho', 'nomade'].map(
    (g) => documentosDoGrupo(relatorio, g).find((d) => d.nome === 'Passaporte válido'),
  );
  assert.ok(nos.every(Boolean));
  assert.equal(new Set(nos.map((d) => d.id)).size, 3, 'os ids têm que ser distintos');
});

test('o id de um item da semente é estável e não depende de acento', async () => {
  const { idDaSemente } = await import('../src/lib/espanha.ts');
  assert.equal(idDaSemente('base', 'Certidão de nascimento atualizada'), idDaSemente('base', 'Certidao de nascimento atualizada'));
  assert.notEqual(idDaSemente('base', 'Passaporte válido'), idDaSemente('nomade', 'Passaporte válido'));
  assert.match(idDaSemente('base', 'CPF regularizado'), /^base:/);
});

test('apagar um item da semente o mantém apagado', async () => {
  const { semear, relatorioVazio, removerDocumento } = await import('../src/lib/relatorio.ts');
  const { relatorio: cheio } = semear(relatorioVazio());
  const alvo = cheio.documentos[0];

  const sem = removerDocumento(cheio, alvo.id);
  assert.equal(sem.documentos.find((d) => d.id === alvo.id), undefined);
  assert.ok(sem.dispensados.includes(alvo.id));

  // Mesmo forçando uma semeadura nova, ele não volta.
  const forcado = semear({ ...sem, sementeVersao: 0 });
  assert.equal(forcado.relatorio.documentos.find((d) => d.id === alvo.id), undefined, 'item apagado não pode ressuscitar');
});

test('semear preserva o que já estava marcado', async () => {
  const { semear, relatorioVazio, alternarDocumento } = await import('../src/lib/relatorio.ts');
  const { relatorio: cheio } = semear(relatorioVazio());
  const marcado = { ...cheio, documentos: cheio.documentos.map((d, i) => (i === 0 ? alternarDocumento(d) : d)) };

  const denovo = semear({ ...marcado, sementeVersao: 0 });
  assert.equal(denovo.relatorio.documentos[0].feito, true, 'semear não pode desmarcar');
  assert.equal(denovo.adicionados, 0);
});

test('documento guardado antes dos grupos cai em "meus" em vez de sumir', async () => {
  const { ler } = await import('../src/lib/relatorio.ts');
  const antigo = JSON.stringify({ documentos: [{ id: 'x1', nome: 'Doc antigo', feito: false }] });
  const r = ler(antigo);
  assert.equal(r.documentos.length, 1);
  assert.equal(r.documentos[0].grupo, 'meus');
});

test('importar não ressuscita item dispensado nem baixa a versão da semente', async () => {
  const { semear, relatorioVazio, removerDocumento, unir } = await import('../src/lib/relatorio.ts');
  const { relatorio: cheio } = semear(relatorioVazio());
  const alvo = cheio.documentos[0];
  const atual = removerDocumento(cheio, alvo.id);

  // O arquivo é de antes de ele apagar: ainda tem o item.
  const { relatorio } = unir(atual, cheio);
  assert.ok(relatorio.dispensados.includes(alvo.id));
  assert.equal(relatorio.sementeVersao, cheio.sementeVersao);
});

test('cada grupo declara se dá para adiantar hoje, e do que depende', async () => {
  const { grupos } = await import('../src/lib/espanha.ts');
  for (const grupo of grupos) {
    assert.ok(grupo.titulo.length > 3, `${grupo.id} sem título`);
    assert.ok(grupo.resumo.length > 20, `${grupo.id} sem resumo`);
    assert.equal(typeof grupo.agora, 'boolean');
    // Um caminho que depende de terceiros precisa dizer de quê.
    if (!grupo.agora) assert.ok(grupo.depende.length > 0, `${grupo.id} não diz do que depende`);
  }
});

// ══════════════ Anexos ══════════════

test('tamanho do arquivo aparece em unidade legível', async () => {
  const { formatarTamanho } = await import('../src/lib/anexos.ts');
  assert.equal(formatarTamanho(512), '512 B');
  assert.equal(formatarTamanho(2048), '2 KB');
  assert.equal(formatarTamanho(5 * 1024 * 1024), '5.0 MB');
  assert.equal(formatarTamanho(0), '0 B');
});

test('anexos são agrupados pelo documento a que pertencem', async () => {
  const { porDocumento, espacoUsado } = await import('../src/lib/anexos.ts');
  const fichas = [
    { id: 'a1', documentoId: 'base:passaporte', nome: 'p.pdf', tipo: 'application/pdf', tamanho: 1000, adicionadoEm: '2026-09-21T10:00:00Z' },
    { id: 'a2', documentoId: 'base:passaporte', nome: 'p2.pdf', tipo: 'application/pdf', tamanho: 2000, adicionadoEm: '2026-09-21T11:00:00Z' },
    { id: 'a3', documentoId: 'base:cpf', nome: 'c.jpg', tipo: 'image/jpeg', tamanho: 500, adicionadoEm: '2026-09-21T12:00:00Z' },
  ];
  const mapa = porDocumento(fichas);
  assert.equal(mapa.get('base:passaporte').length, 2);
  assert.equal(mapa.get('base:cpf').length, 1);
  assert.equal(mapa.get('nao-existe'), undefined);
  assert.equal(espacoUsado(fichas), 3500);
});

test('espaço usado de lista vazia é zero, não NaN', async () => {
  const { espacoUsado } = await import('../src/lib/anexos.ts');
  assert.equal(espacoUsado([]), 0);
});

test('o limite por arquivo é declarado e é razoável para documento', async () => {
  const { TAMANHO_MAXIMO, formatarTamanho } = await import('../src/lib/anexos.ts');
  assert.ok(TAMANHO_MAXIMO >= 10 * 1024 * 1024, 'um PDF escaneado pode passar de 10 MB');
  assert.ok(TAMANHO_MAXIMO <= 50 * 1024 * 1024, 'acima disso não é documento, é vídeo');
  assert.equal(formatarTamanho(TAMANHO_MAXIMO), '25.0 MB');
});
