'use strict';

/**
 * Canal de atualização do aplicativo.
 *
 * O conteúdo do Hub é o site ao vivo, então ele se atualiza sozinho — mas o
 * Electron que roda em volta, não. Sem este canal, uma correção de segurança
 * do Electron só chegaria se alguém reinstalasse o .exe à mão.
 *
 * A atualização baixa em segundo plano e nunca reinicia sem a pessoa mandar:
 * quem está no meio de uma gravação ou de um formulário não pode ser
 * interrompido. Falhas são silenciosas de propósito — ficar sem atualizar não
 * é motivo para atrapalhar quem só quer usar o Hub.
 */

const { app, dialog } = require('electron');

const SIX_HOURS = 6 * 60 * 60 * 1000;
let started = false;

function startUpdates(getWindow) {
  // Em desenvolvimento não existe pacote instalado para substituir.
  if (started || !app.isPackaged) return;
  started = true;

  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch {
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('error', () => { /* rede fora, release ausente: não é assunto da pessoa */ });

  autoUpdater.on('update-downloaded', async (info) => {
    const window = getWindow();
    if (!window || window.isDestroyed()) return;
    const { response } = await dialog.showMessageBox(window, {
      type: 'info',
      title: 'ARTX Hub',
      message: `Versão ${info?.version ?? 'nova'} pronta para instalar.`,
      detail: 'A atualização já foi baixada. Você pode instalar agora ou da próxima vez que fechar o aplicativo.',
      buttons: ['Instalar e reiniciar', 'Depois'],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });

  const check = () => autoUpdater.checkForUpdates().catch(() => undefined);
  setTimeout(check, 10_000);
  setInterval(check, SIX_HOURS);
  manualCheck = async (window) => {
    try {
      const result = await autoUpdater.checkForUpdates();
      const remote = result?.updateInfo?.version;
      if (remote && remote !== app.getVersion()) {
        // O download já começou sozinho; o aviso de "pronta para instalar" vem depois.
        return { state: 'baixando', version: remote };
      }
      return { state: 'atual', version: app.getVersion() };
    } catch {
      return { state: 'falhou', version: app.getVersion() };
    }
  };
}

/**
 * Verificação sob demanda.
 *
 * A checagem automática já roda sozinha, mas sem um jeito de pedir agora não há
 * como saber se ela está funcionando — só esperar. Este caminho existe para a
 * pessoa conferir quando quiser.
 */
let manualCheck = null;

async function checkNow(window) {
  if (!app.isPackaged) {
    await dialog.showMessageBox(window, {
      type: 'info',
      title: 'ARTX Hub',
      message: 'Atualização não se aplica aqui.',
      detail: 'Você está rodando a versão de desenvolvimento, que não tem pacote instalado para substituir.',
      noLink: true,
    });
    return;
  }
  if (!manualCheck) return;

  const result = await manualCheck(window);
  const messages = {
    baixando: {
      message: `Versão ${result.version} encontrada.`,
      detail: 'O download já começou em segundo plano. Quando terminar, você decide se instala na hora ou ao fechar o aplicativo.',
    },
    atual: {
      message: `Você já está na versão ${result.version}.`,
      detail: 'Não há atualização disponível. O aplicativo verifica sozinho ao abrir e a cada seis horas.',
    },
    falhou: {
      message: 'Não foi possível verificar agora.',
      detail: 'Pode ser a conexão. O aplicativo continua funcionando e tentará de novo sozinho.',
    },
  };
  await dialog.showMessageBox(window, {
    type: result.state === 'falhou' ? 'warning' : 'info',
    title: 'ARTX Hub',
    ...messages[result.state],
    noLink: true,
  });
}

module.exports = { startUpdates, checkNow };
