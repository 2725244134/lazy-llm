import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { app, BaseWindow } from 'electron';
import type { PaneCount } from '@shared-contracts/ipc/contracts';
import { getConfig, getResolvedSettings, setDefaultPaneCount, setDefaultProvider } from './main-services/ipc-handlers/store.js';
import {
  attachPaneNetworkDiagnostics,
  PANE_SESSION_PARTITION,
} from './main-services/network/paneSession.js';
import { registerIpcHandlers } from './main-services/ipc/register.js';
import { ViewManager } from './main-services/views/manager.js';

const shouldSkipSingleInstanceLock = process.env.LAZYLLM_SKIP_SINGLE_INSTANCE_LOCK === '1';
const overrideUserDataDir = process.env.LAZYLLM_USER_DATA_DIR;
const paneUserAgentStrategy = 'chrome' as const;

if (typeof overrideUserDataDir === 'string' && overrideUserDataDir.trim().length > 0) {
  app.setPath('userData', overrideUserDataDir);
} else if (shouldSkipSingleInstanceLock) {
  app.setPath('userData', join(tmpdir(), `lazy-llm-e2e-${process.pid}`));
}

if (!shouldSkipSingleInstanceLock) {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
  }
}

let mainWindow: BaseWindow | null = null;
let viewManager: ViewManager | null = null;

function createWindow(): void {
  const settings = getResolvedSettings();
  const rendererDevServerUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL;

  mainWindow = new BaseWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    autoHideMenuBar: true,
  });

  mainWindow.setMenuBarVisibility(false);

  viewManager = new ViewManager(mainWindow, {
    config: settings.config,
    runtimePreferences: settings.runtimePreferences,
    rendererDevServerUrl,
    paneSessionPartition: PANE_SESSION_PARTITION,
    paneUserAgentStrategy,
  });

  viewManager.initSidebar();
  viewManager.setPaneCount(settings.config.provider.pane_count as PaneCount);

  mainWindow.on('resize', () => {
    viewManager?.updateLayout();
  });

  mainWindow.on('focus', () => {
    viewManager?.restoreFocus();
  });

  mainWindow.on('close', () => {
    viewManager?.destroy();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    viewManager = null;
  });
}

app.whenReady().then(() => {
  attachPaneNetworkDiagnostics((record) => {
    if (record.resourceType !== 'mainFrame' && record.resourceType !== 'subFrame') {
      return;
    }
    console.warn('[PaneSession] Request failed', record);
  });

  registerIpcHandlers({
    getViewManager: () => viewManager,
    getConfig: () => getConfig(),
    setDefaultPaneCount: (paneCount) => {
      setDefaultPaneCount(paneCount);
    },
    setDefaultProvider: (paneIndex, providerKey) => {
      setDefaultProvider(paneIndex, providerKey);
    },
  });

  createWindow();

  app.on('activate', () => {
    if (BaseWindow.getAllWindows().length === 0) {
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
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.focus();
});
