import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { IPC_CHANNELS } from './ipc/contracts.js';
import { getConfig } from './ipc-handlers/store.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register IPC handlers
function registerIPCHandlers() {
  // Health check
  ipcMain.handle(IPC_CHANNELS.APP_HEALTH, () => {
    return {
      ok: true,
      runtime: 'electron',
      version: app.getVersion(),
    };
  });

  // Get config
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, () => {
    return getConfig();
  });

  // Set pane count
  ipcMain.handle(IPC_CHANNELS.PANE_SET_COUNT, (_event, request: { count: 1 | 2 | 3 | 4 }) => {
    // TODO: Implement pane management
    console.log('[IPC] pane:setCount', request);
    return { success: true };
  });

  // Update provider for pane
  ipcMain.handle(IPC_CHANNELS.PANE_UPDATE_PROVIDER, (_event, request: { paneIndex: number; providerKey: string }) => {
    // TODO: Implement provider switching
    console.log('[IPC] pane:updateProvider', request);
    return { success: true, paneIndex: request.paneIndex };
  });

  // Send prompt to all panes
  ipcMain.handle(IPC_CHANNELS.PROMPT_SEND, (_event, request: { text: string }) => {
    // TODO: Implement prompt broadcast
    console.log('[IPC] prompt:send', request);
    return { success: true };
  });
}

// App lifecycle
app.whenReady().then(() => {
  registerIPCHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
