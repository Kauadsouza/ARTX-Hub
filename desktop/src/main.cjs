'use strict';

const { app, BrowserWindow, Menu, dialog, shell, session } = require('electron');
const path = require('node:path');
const policy = require('./policy.cjs');
const RELEASE_URL = 'https://github.com/Kauadsouza/ARTX-Hub/releases/latest';
let window;
let externalPromptOpen = false;
let audioGranted = false;

app.enableSandbox();
app.setAppUserModelId('com.kauaartx.hub');
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.show(); window.focus();
  });
  app.whenReady().then(createWindow);
}

async function openExternal(value) {
  const target = policy.externalTarget(value);
  if (!target || externalPromptOpen || !window || window.isDestroyed()) return;
  externalPromptOpen = true;
  try {
    const result = await dialog.showMessageBox(window, {
      type: 'question', title: 'ARTX Hub',
      message: target === 'condor://open' ? 'Abrir o Condor instalado neste PC?' : 'Abrir este endereço no navegador?',
      detail: target, buttons: ['Cancelar', 'Abrir'], defaultId: 0, cancelId: 0,
    });
    if (result.response === 1) await shell.openExternal(target);
  } catch {
    await dialog.showMessageBox(window, { type: 'info', message: 'Não foi possível abrir o aplicativo ou endereço.', detail: 'Para usar o Condor, instale-o neste computador primeiro.' });
  } finally { externalPromptOpen = false; }
}

async function loadHub() {
  try { await window.loadURL(policy.HUB_URL); }
  catch {
    if (!window || window.isDestroyed()) return;
    const result = await dialog.showMessageBox(window, {
      type: 'info', title: 'Conectar ao Hub',
      message: 'Não foi possível conectar ao Hub.',
      detail: 'Verifique sua conexão. Este aplicativo usa o mesmo serviço online do site. Seus dados sincronizados continuam na sua conta.',
      buttons: ['Tentar novamente', 'Fechar'], defaultId: 0, cancelId: 1,
    });
    if (result.response === 0) void loadHub(); else app.quit();
  }
}

function createWindow() {
  const workspaceSession = session.fromPartition('persist:artx-hub');
  workspaceSession.setPermissionCheckHandler((_contents, permission, origin, details) =>
    audioGranted && permission === 'media' && origin === policy.STUDY_ORIGIN && details.mediaType === 'audio');
  workspaceSession.setPermissionRequestHandler(async (contents, permission, callback, details) => {
    if (contents !== window?.webContents || !policy.isHub(contents.getURL())
      || !policy.canRequestAudio(permission, details.requestingUrl, details.mediaTypes)) return callback(false);
    try {
      const result = await dialog.showMessageBox(window, {
        type: 'question', title: 'Prática de inglês',
        message: 'Permitir o microfone para a prática de inglês nesta sessão?',
        detail: policy.STUDY_ORIGIN, buttons: ['Não permitir', 'Permitir'], defaultId: 0, cancelId: 0,
      });
      audioGranted = result.response === 1;
      callback(audioGranted);
    } catch { callback(false); }
  });
  workspaceSession.setDevicePermissionHandler(() => false);
  workspaceSession.on('will-download', (event, item, contents) => {
    if (contents !== window?.webContents || !policy.isHub(contents.getURL()) || !policy.canDownload(item.getURL())) {
      event.preventDefault(); return;
    }
    item.setSaveDialogOptions({ title: 'Salvar arquivo do Hub' });
    // Always use the native save dialog. Never execute or automatically open downloads.
  });

  window = new BrowserWindow({
    title: 'ARTX Hub', width: 1440, height: 940, minWidth: 800, minHeight: 600,
    backgroundColor: '#0a0c10', icon: path.join(__dirname, '../assets/icon.ico'),
    webPreferences: {
      session: workspaceSession, sandbox: true, contextIsolation: true,
      nodeIntegration: false, nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false, webviewTag: false,
      webSecurity: true, allowRunningInsecureContent: false,
      navigateOnDragDrop: false, devTools: !app.isPackaged,
    },
  });
  const contents = window.webContents;
  contents.on('will-attach-webview', event => event.preventDefault());
  contents.on('will-navigate', event => {
    if (!policy.isHub(event.url)) { event.preventDefault(); void openExternal(event.url); }
  });
  contents.on('will-frame-navigate', event => {
    if (!policy.canNavigate(event.url, event.isMainFrame)) {
      event.preventDefault();
      if (event.isMainFrame) void openExternal(event.url);
    }
  });
  contents.on('will-redirect', event => {
    if (!policy.canNavigate(event.url, event.isMainFrame)) event.preventDefault();
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (policy.isHub(url)) void window.loadURL(url);
    else void openExternal(url);
    return { action: 'deny' };
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Hub', submenu: [
      { label: 'Início', click: () => void loadHub() },
      { label: 'Recarregar', accelerator: 'CmdOrCtrl+R', click: () => contents.reload() },
      { type: 'separator' }, { role: 'quit', label: 'Sair' },
    ] },
    { label: 'Editar', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'Visualizar', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] },
    { label: 'Ajuda', submenu: [
      { label: 'Versões e atualizações', click: () => void shell.openExternal(RELEASE_URL) },
      { label: 'Abrir o site', click: () => void shell.openExternal(policy.HUB_URL) },
      { label: 'Sobre', click: () => void dialog.showMessageBox(window, { title: 'ARTX Hub', message: `ARTX Hub ${app.getVersion()}`, detail: 'Aplicativo para Windows. Use sua conta do Hub para acessar os mesmos dados do site. O Condor requer instalação separada.' }) },
    ] },
  ]));
  window.on('closed', () => { window = null; });
  void loadHub();
}

app.on('window-all-closed', () => app.quit());
