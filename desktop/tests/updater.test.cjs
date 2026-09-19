'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const Module = require('node:module');

/**
 * O canal de atualização não pode ser carregado com o Electron de verdade num
 * teste. Aqui trocamos `electron` por um substituto e verificamos o contrato:
 * o que o módulo expõe e como ele se comporta fora de um pacote instalado.
 */
function loadUpdater({ isPackaged = false, version = '1.0.1' } = {}) {
  const boxes = [];
  const electron = {
    app: { isPackaged, getVersion: () => version },
    dialog: {
      showMessageBox: async (_window, options) => {
        boxes.push(options);
        return { response: 0 };
      },
    },
  };

  const original = Module._load;
  Module._load = function patched(request, parent, isMain) {
    if (request === 'electron') return electron;
    return original.call(this, request, parent, isMain);
  };
  try {
    const target = path.join(__dirname, '..', 'src', 'updater.cjs');
    delete require.cache[require.resolve(target)];
    return { updater: require(target), boxes };
  } finally {
    Module._load = original;
  }
}

test('o módulo expõe partida automática e verificação sob demanda', () => {
  const { updater } = loadUpdater();
  assert.equal(typeof updater.startUpdates, 'function');
  assert.equal(typeof updater.checkNow, 'function');
});

test('fora de um pacote instalado nada é atualizado, e isso é dito com clareza', async () => {
  const { updater, boxes } = loadUpdater({ isPackaged: false });

  // Em desenvolvimento não existe .exe para substituir: iniciar precisa ser inerte.
  assert.doesNotThrow(() => updater.startUpdates(() => null));

  await updater.checkNow(null);
  assert.equal(boxes.length, 1);
  assert.match(boxes[0].message, /não se aplica/i);
  assert.match(boxes[0].detail, /desenvolvimento/i);
});

test('verificar sob demanda não explode quando o canal nunca subiu', async () => {
  const { updater, boxes } = loadUpdater({ isPackaged: true });
  // startUpdates não foi chamado, então não há canal: precisa sair em silêncio,
  // nunca derrubar a janela de quem só clicou num item de menu.
  await assert.doesNotReject(() => updater.checkNow(null));
  assert.equal(boxes.length, 0);
});

test('iniciar duas vezes não cria um segundo canal', () => {
  const { updater } = loadUpdater({ isPackaged: false });
  assert.doesNotThrow(() => {
    updater.startUpdates(() => null);
    updater.startUpdates(() => null);
  });
});
