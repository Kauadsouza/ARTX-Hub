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
  assert.equal(formatarTamanho(TAMANHO_MAXIMO), '15.0 MB', 'o teto é o do cofre da conta');
});

// ══════════════ Validade dos documentos ══════════════

test('documento sem prazo não inventa vencimento', async () => {
  const { criarDocumento, estadoValidade, diasParaVencer } = await import('../src/lib/relatorio.ts');
  const d = criarDocumento('Passaporte');
  assert.equal(d.validade, null);
  assert.equal(diasParaVencer(d), null);
  assert.equal(estadoValidade(d), 'sem-prazo');
});

test('a validade conta dias de calendário, como o resto', async () => {
  const { criarDocumento, definirValidade, diasParaVencer } = await import('../src/lib/relatorio.ts');
  const d = definirValidade(criarDocumento('Antecedentes'), '2026-12-25');
  assert.equal(diasParaVencer(d, meioDia('2026-12-25')), 0, 'vence hoje é zero');
  assert.equal(diasParaVencer(d, new Date('2026-12-25T23:00:00')), 0, 'a hora não muda o dia');
  assert.equal(diasParaVencer(d, meioDia('2026-12-24')), 1);
  assert.equal(diasParaVencer(d, meioDia('2026-12-26')), -1);
});

test('os três estados aparecem na hora certa', async () => {
  const { criarDocumento, definirValidade, estadoValidade, AVISO_DE_VENCIMENTO } = await import('../src/lib/relatorio.ts');
  const d = definirValidade(criarDocumento('Certidão'), '2026-12-25');
  assert.equal(estadoValidade(d, meioDia('2026-06-01')), 'em-dia');
  assert.equal(estadoValidade(d, meioDia('2026-12-25')), 'vencendo', 'o dia do vencimento ainda é aviso, não vencido');
  assert.equal(estadoValidade(d, meioDia('2026-12-26')), 'vencido');

  // Um dia antes da janela de aviso ainda é "em dia".
  const limite = new Date(2026, 11, 25);
  limite.setDate(limite.getDate() - AVISO_DE_VENCIMENTO - 1);
  assert.equal(estadoValidade(d, limite), 'em-dia');
});

test('limpar o campo de data volta a ser sem prazo', async () => {
  const { criarDocumento, definirValidade, estadoValidade } = await import('../src/lib/relatorio.ts');
  const d = definirValidade(criarDocumento('x'), '2026-12-25');
  assert.equal(definirValidade(d, '').validade, null);
  assert.equal(definirValidade(d, null).validade, null);
  assert.equal(estadoValidade(definirValidade(d, '')), 'sem-prazo');
});

test('documento vencido continua marcado: desmarcar sozinho seria reescrever o que ele registrou', async () => {
  const { criarDocumento, definirValidade, alternarDocumento, estadoValidade } = await import('../src/lib/relatorio.ts');
  const d = definirValidade(alternarDocumento(criarDocumento('Antecedentes')), '2026-01-01');
  assert.equal(d.feito, true);
  assert.equal(estadoValidade(d, meioDia('2026-09-21')), 'vencido');
  assert.equal(d.feito, true, 'o estado de validade não pode mexer no que foi marcado');
});

test('os que precisam de atenção vêm dos mais urgentes para os menos', async () => {
  const { criarDocumento, definirValidade, precisamAtencao } = await import('../src/lib/relatorio.ts');
  const agora = meioDia('2026-09-21');
  const lista = [
    definirValidade(criarDocumento('tranquilo'), '2027-06-01'),
    definirValidade(criarDocumento('vencendo'), '2026-10-05'),
    definirValidade(criarDocumento('vencido'), '2026-08-01'),
    criarDocumento('sem prazo'),
  ];
  assert.deepEqual(
    precisamAtencao(lista, agora).map((d) => d.nome),
    ['vencido', 'vencendo'],
  );
});

// ══════════════ Renomear sem orfanar anexo ══════════════

test('item renomeado mantém o id, porque o id é a chave dos anexos', async () => {
  const { semear, relatorioVazio, alternarDocumento } = await import('../src/lib/relatorio.ts');
  const { renomeados } = await import('../src/lib/espanha.ts');
  assert.ok(renomeados.length > 0);

  // Semeia na versão antiga, com o nome antigo.
  const antigo = {
    ...relatorioVazio(),
    documentos: [{ id: renomeados[0].id, nome: 'Nome antigo', nota: '', feito: false, feitoEm: null, grupo: 'estudante', validade: null }],
    sementeVersao: 1,
  };
  // Marca como feito, como se ele já tivesse resolvido e anexado algo.
  antigo.documentos[0] = alternarDocumento(antigo.documentos[0]);

  const { relatorio } = semear(antigo);
  const item = relatorio.documentos.find((d) => d.id === renomeados[0].id);
  assert.ok(item, 'o id tem que sobreviver, senão os anexos ficam órfãos');
  assert.equal(item.nome, renomeados[0].nome);
  assert.equal(item.feito, true, 'renomear não desmarca');
  assert.equal(relatorio.documentos.filter((d) => d.nome === renomeados[0].nome).length, 1, 'não pode duplicar');
});

// ══════════════ A observação do documento ══════════════

test('a observação da semente chega também em instalação nova', async () => {
  const { semear, relatorioVazio } = await import('../src/lib/relatorio.ts');
  const { semente } = await import('../src/lib/espanha.ts');

  const comNota = semente.filter((item) => item.nota);
  assert.ok(comNota.length > 0, 'ao menos um item da semente traz observação');

  const { relatorio } = semear(relatorioVazio());
  for (const item of comNota) {
    const doc = relatorio.documentos.find((d) => d.nome === item.nome);
    assert.ok(doc, `${item.nome} não foi semeado`);
    assert.equal(doc.nota, item.nota, 'a observação não pode ficar só para quem já tinha a versão antiga');
  }
});

test('a observação é editável e limitada', async () => {
  const { criarDocumento, definirNota } = await import('../src/lib/relatorio.ts');
  const d = criarDocumento('Antecedentes');
  const anotado = definirNota(d, 'Tirar na Polícia Federal, validade de 90 dias');
  assert.equal(anotado.nota, 'Tirar na Polícia Federal, validade de 90 dias');
  assert.equal(definirNota(d, 'x'.repeat(2000)).nota.length, 1000);
  assert.equal(definirNota(anotado, '').nota, '', 'apagar a observação é permitido');
  assert.equal(d.nota, '', 'o documento original não muda');
});

test('editar a observação não mexe em mais nada', async () => {
  const { criarDocumento, definirNota, alternarDocumento, definirValidade } = await import('../src/lib/relatorio.ts');
  const base = definirValidade(alternarDocumento(criarDocumento('Passaporte')), '2030-01-01');
  const depois = definirNota(base, 'observação nova');
  assert.equal(depois.feito, base.feito);
  assert.equal(depois.feitoEm, base.feitoEm);
  assert.equal(depois.validade, base.validade);
  assert.equal(depois.id, base.id);
});

// ══════════════ O resumo que a Visão geral lê ══════════════

test('sem nada guardado o resumo é zerado, não quebra', async () => {
  const { resumoParaOHub } = await import('../src/lib/relatorio.ts');
  for (const entrada of [null, '', '{', 'lixo']) {
    const r = resumoParaOHub(entrada);
    assert.equal(r.vencendo, 0);
    assert.equal(r.vencidos, 0);
    assert.equal(r.proximo, null);
  }
});

test('o resumo separa o que venceu do que está vencendo', async () => {
  const { resumoParaOHub, criarDocumento, definirValidade, relatorioVazio } = await import('../src/lib/relatorio.ts');
  const agora = meioDia('2026-09-21');
  const guardado = JSON.stringify({
    ...relatorioVazio(),
    documentos: [
      definirValidade(criarDocumento('Antecedentes'), '2026-08-01'),
      definirValidade(criarDocumento('Certidão'), '2026-10-05'),
      definirValidade(criarDocumento('Passaporte'), '2030-01-01'),
      criarDocumento('Sem prazo'),
    ],
  });

  const r = resumoParaOHub(guardado, agora);
  assert.equal(r.vencidos, 1);
  assert.equal(r.vencendo, 1);
  assert.equal(r.proximo.nome, 'Antecedentes', 'o mais urgente vem primeiro');
  assert.ok(r.proximo.dias < 0);
});

test('documento em dia não gera alerta nenhum', async () => {
  const { resumoParaOHub, criarDocumento, definirValidade, relatorioVazio } = await import('../src/lib/relatorio.ts');
  const guardado = JSON.stringify({
    ...relatorioVazio(),
    documentos: [definirValidade(criarDocumento('Passaporte'), '2030-01-01')],
  });
  const r = resumoParaOHub(guardado, meioDia('2026-09-21'));
  assert.equal(r.vencendo + r.vencidos, 0);
  assert.equal(r.proximo, null, 'sem alerta não há próximo');
});

test('o resumo só lê: não escreve nada no relatório', async () => {
  const { resumoParaOHub, criarDocumento, definirValidade, relatorioVazio } = await import('../src/lib/relatorio.ts');
  const original = JSON.stringify({
    ...relatorioVazio(),
    documentos: [definirValidade(criarDocumento('x'), '2026-08-01')],
  });
  const copia = String(original);
  resumoParaOHub(original, meioDia('2026-09-21'));
  assert.equal(original, copia);
});

// ══════════════ O espelho na conta ══════════════

test('sem cliente de conta, o relatório continua funcionando e diz por quê', async () => {
  const { puxar, empurrar, protegido } = await import('../src/lib/relatorio-espelho.ts');
  const { relatorioVazio, criarDocumento } = await import('../src/lib/relatorio.ts');
  const local = { ...relatorioVazio(), documentos: [criarDocumento('Passaporte')] };

  const lido = await puxar(null, local);
  assert.equal(lido.relatorio, local, 'o que está aqui não pode ser perdido');
  assert.equal(lido.estado.tipo, 'so-local');
  assert.equal(protegido(lido.estado), false, 'não pode dizer que está protegido quando não está');

  const escrito = await empurrar(null, local, 0);
  assert.equal(escrito.estado.tipo, 'so-local');
});

test('a constraint que falta vira uma frase que diz o que fazer', async () => {
  const { puxar, descrever } = await import('../src/lib/relatorio-espelho.ts');
  const { relatorioVazio } = await import('../src/lib/relatorio.ts');
  const fake = {
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'new row violates check constraint "hub_app_state_app_check"' } }) }) }) }) }),
  };
  const r = await puxar(fake, relatorioVazio());
  assert.equal(r.estado.tipo, 'so-local');
  assert.match(descrever(r.estado), /relatorio-state\.sql/, 'precisa dizer qual arquivo rodar');
});

test('a cópia da conta é juntada, nunca sobrescreve o que está aqui', async () => {
  const { puxar } = await import('../src/lib/relatorio-espelho.ts');
  const { relatorioVazio, criarDocumento, alternarDocumento } = await import('../src/lib/relatorio.ts');

  const doc = criarDocumento('Antecedentes');
  const feitoAqui = alternarDocumento(doc);
  const local = { ...relatorioVazio(), documentos: [feitoAqui] };

  // A conta tem o mesmo documento ainda pendente, mais um que falta aqui.
  const remoto = { ...relatorioVazio(), documentos: [doc, criarDocumento('NIE')] };
  const fake = {
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { payload: remoto, revision: 7 }, error: null }) }) }) }) }),
  };

  const r = await puxar(fake, local);
  assert.equal(r.revisao, 7, 'a revisão precisa vir junto para a gravação não atropelar');
  assert.equal(r.relatorio.documentos.length, 2, 'o que faltava aqui entrou');
  assert.equal(r.relatorio.documentos.find((d) => d.id === doc.id).feito, true, 'uma cópia antiga não desmarca o que já está pronto');
  assert.equal(r.estado.tipo, 'guardado');
});

test('sem cópia na conta ainda, o estado é "iniciando" e a revisão é zero', async () => {
  const { puxar } = await import('../src/lib/relatorio-espelho.ts');
  const { relatorioVazio } = await import('../src/lib/relatorio.ts');
  const fake = {
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }),
  };
  const r = await puxar(fake, relatorioVazio());
  assert.equal(r.estado.tipo, 'iniciando');
  assert.equal(r.revisao, 0, 'zero é o que a função do banco espera para criar a primeira linha');
});

test('gravação bem-sucedida devolve a revisão nova', async () => {
  const { empurrar, protegido } = await import('../src/lib/relatorio-espelho.ts');
  const { relatorioVazio } = await import('../src/lib/relatorio.ts');
  const fake = { rpc: async () => ({ data: 8, error: null }) };
  const r = await empurrar(fake, relatorioVazio(), 7);
  assert.equal(r.revisao, 8);
  assert.equal(protegido(r.estado), true);
});

test('gravação recusada por outra aba não perde nada e explica', async () => {
  const { empurrar, descrever } = await import('../src/lib/relatorio-espelho.ts');
  const { relatorioVazio } = await import('../src/lib/relatorio.ts');
  const fake = { rpc: async () => ({ data: null, error: { code: '40001', message: 'Newer progress exists on another device' } }) };
  const r = await empurrar(fake, relatorioVazio(), 7);
  assert.equal(r.estado.tipo, 'falhou');
  assert.equal(r.revisao, 7, 'a revisão não avança quando o banco recusou');
  assert.match(descrever(r.estado), /juntar/i);
});

// ══════════════ Os anexos no cofre ══════════════

test('o caminho no cofre começa pela pasta do dono, que é o que a política do banco olha', async () => {
  const { caminho, PREFIXO } = await import('../src/lib/anexos-cofre.ts');
  const p = caminho('uid-123', 'anexo-abc-def', 'meu passaporte.pdf');
  assert.ok(p.startsWith('uid-123/'), 'a pasta do usuário precisa vir primeiro');
  assert.ok(p.includes(`/${PREFIXO}/`), 'prefixo próprio, sem misturar com o University Path');
  assert.ok(p.includes('anexo-abc-def'), 'o id evita que dois arquivos de mesmo nome se atropelem');
  assert.ok(!p.includes(' '), 'espaço no caminho quebra a URL do storage');
});

test('nome de arquivo com caracteres estranhos não escapa do caminho', async () => {
  const { caminho } = await import('../src/lib/anexos-cofre.ts');
  const p = caminho('uid', 'id1', '../../etc/passwd');
  assert.ok(!p.includes('..'), 'não pode subir de pasta');
  assert.equal(p.split('/').length, 3, 'o caminho tem exatamente dono/prefixo/arquivo');
});

test('o limite local é o mesmo do cofre: nada é aceito aqui que não caiba lá', async () => {
  const local = await import('../src/lib/anexos.ts');
  const cofre = await import('../src/lib/anexos-cofre.ts');
  assert.equal(local.TAMANHO_MAXIMO, cofre.TAMANHO_MAXIMO, 'aceitar mais aqui criaria arquivo que nunca seria protegido');
});

test('o cofre só aceita os formatos que o bucket guarda', async () => {
  const { TIPOS_ACEITOS } = await import('../src/lib/anexos-cofre.ts');
  assert.deepEqual([...TIPOS_ACEITOS].sort(), ['application/pdf', 'image/jpeg', 'image/png']);
});

test('sem conta, subir e listar falham dizendo o motivo — nunca em silêncio', async () => {
  const { subir, listarNoCofre, restaurar } = await import('../src/lib/anexos-cofre.ts');
  const ficha = { id: 'a1', documentoId: 'd1', nome: 'x.pdf', tipo: 'application/pdf', tamanho: 10, adicionadoEm: '2026-09-21T00:00:00Z' };

  const s = await subir(null, ficha);
  assert.equal(s.ok, false);
  assert.ok(s.motivo.length > 10);

  const l = await listarNoCofre(null);
  assert.equal(l.ok, false);

  const r = await restaurar(null, []);
  assert.equal(r.baixados, 0);
  assert.ok(r.motivo);
});

// ══════════════ Busca unificada ══════════════

test('anotações e documentos viram itens de busca, com o estado de cada um', async () => {
  const { itensParaBusca, relatorioVazio, criarAnotacao, criarDocumento, definirValidade, alternarDocumento, definirNota } = await import('../src/lib/relatorio.ts');
  const agora = meioDia('2026-09-21');

  const guardado = JSON.stringify({
    ...relatorioVazio(),
    anotacoes: [criarAnotacao('Ligar pro consulado', 'pedir a lista vigente', meioDia('2026-09-20'))],
    documentos: [
      alternarDocumento(criarDocumento('Passaporte')),
      definirValidade(criarDocumento('Antecedentes'), '2026-08-01'),
      definirNota(criarDocumento('CPF'), 'tirar segunda via na Receita'),
    ],
  });

  const itens = itensParaBusca(guardado, agora);
  assert.equal(itens.length, 4);

  const nota = itens.find((i) => i.grupo === 'Anotações');
  assert.match(nota.texto, /Ligar pro consulado/);
  assert.match(nota.texto, /lista vigente/, 'a descrição entra na busca: quem lembra do conteúdo e não do nome ainda acha');

  assert.equal(itens.find((i) => i.texto.startsWith('Passaporte')).detalhe, 'pronto');
  assert.equal(itens.find((i) => i.texto.startsWith('Antecedentes')).detalhe, 'vencido');
  assert.match(itens.find((i) => i.texto.startsWith('CPF')).texto, /segunda via/, 'a observação também é buscável');
});

test('relatório vazio não gera item de busca, e lixo não quebra', async () => {
  const { itensParaBusca } = await import('../src/lib/relatorio.ts');
  for (const entrada of [null, '', '{', 'lixo', '{"anotacoes":1}']) {
    assert.deepEqual(itensParaBusca(entrada), []);
  }
});

// ══════════════ O aviso no título ══════════════

test('o contador entra e sai do título sem empilhar', async () => {
  globalThis.document = { title: 'ARTX Hub' };
  const { marcarTitulo, limparTitulo } = await import('../src/lib/aviso-titulo.ts');

  marcarTitulo(3);
  assert.equal(document.title, '(3) ARTX Hub');

  marcarTitulo(2);
  assert.equal(document.title, '(2) ARTX Hub', 'não pode virar "(2) (3) ARTX Hub"');

  marcarTitulo(0);
  assert.equal(document.title, 'ARTX Hub', 'zero devolve o título limpo');

  marcarTitulo(1);
  limparTitulo();
  assert.equal(document.title, 'ARTX Hub');
  delete globalThis.document;
});

test('o texto do aviso cobre os três casos e cala quando não há nada', async () => {
  const { textoDoAviso } = await import('../src/lib/aviso-titulo.ts');
  assert.equal(textoDoAviso(0, 0), null, 'sem nada, não avisa');
  assert.match(textoDoAviso(2, 0), /venceram/);
  assert.match(textoDoAviso(0, 3), /vencendo/);
  const ambos = textoDoAviso(1, 2);
  assert.match(ambos, /vencido/);
  assert.match(ambos, /vencendo/);
});

test('nunca dispara nem pede permissão sem que tenha sido concedida', async () => {
  const { avisarSePermitido, podeOferecer } = await import('../src/lib/aviso-titulo.ts');
  // Sem a API do navegador, as duas coisas respondem sem explodir.
  assert.equal(avisarSePermitido('x'), false);
  assert.equal(podeOferecer(), false);
});

// ══════════════ A nota da Jade vai para o Relatório ══════════════

import { anotarNoRelatorio } from '../src/lib/relatorio.ts';

test('a nota da Jade entra no topo das anotações do Relatório', () => {
  const r = anotarNoRelatorio(null, 'Ideia de vídeo: setup 2026');
  assert.ok(r);
  assert.equal(r.relatorio.anotacoes[0].titulo, 'Ideia de vídeo: setup 2026');
});

test('as anotações que já existiam continuam lá', () => {
  const primeira = anotarNoRelatorio(null, 'Primeira');
  const segunda = anotarNoRelatorio(JSON.stringify(primeira.relatorio), 'Segunda');
  assert.deepEqual(segunda.relatorio.anotacoes.map(a => a.titulo), ['Segunda', 'Primeira']);
});

test('os documentos não são tocados por uma anotação nova', () => {
  const antes = anotarNoRelatorio(null, 'x').relatorio;
  const depois = anotarNoRelatorio(JSON.stringify(antes), 'y').relatorio;
  assert.deepEqual(depois.documentos, antes.documentos);
});

test('nota sem texto não vira anotação em branco', () => {
  assert.equal(anotarNoRelatorio(null, '   '), null);
});
