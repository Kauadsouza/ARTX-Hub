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
}

module.exports = { startUpdates };
