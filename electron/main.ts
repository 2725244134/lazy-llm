import { app, BaseWindow, ipcMain } from 'electron';
import { IPC_CHANNELS } from './ipc/contracts.js';
import { APP_CONFIG } from '../src/config/app.js';
import type {
  PaneCountRequest,
  PaneUpdateRequest,
  PromptRequest,
  PromptSyncRequest,
  LayoutUpdateRequest,
  SidebarWidthRequest,
  PaneCount,
  PaneResponseReadyPayload,
  QuickPromptResizeRequest,
} from './ipc/contracts.js';
import {
  getConfig,
  getResolvedSettings,
  setDefaultPaneCount,
  setDefaultProvider,
} from './ipc-handlers/store.js';
import { ViewManager } from './views/manager.js';

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
}

let mainWindow: BaseWindow | null = null;
let viewManager: ViewManager | null = null;

function createWindow() {
  mainWindow = new BaseWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    autoHideMenuBar: true,
  });

  // Keep menu hidden by default for frameless mode.
  mainWindow.setMenuBarVisibility(false);

  const settings = getResolvedSettings();

  // Initialize ViewManager
  viewManager = new ViewManager(mainWindow, {
    config: settings.config,
    runtimePreferences: settings.runtimePreferences,
  });
  viewManager.initSidebar();

  // Set initial pane count from config
  const initialPaneCount = validatePaneCount(settings.config.provider.pane_count);
  viewManager.setPaneCount(initialPaneCount);

  // Update layout on window resize
  mainWindow.on('resize', () => {
    viewManager?.updateLayout();
  });

  // Clean up resources before window closes
  mainWindow.on('close', () => {
    viewManager?.destroy();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    viewManager = null;
  });
}

// Input validation helpers
function validatePaneCount(count: unknown): PaneCount {
  if (typeof count !== 'number' || !Number.isInteger(count)) {
    return APP_CONFIG.layout.pane.defaultCount as PaneCount;
  }
  if (count < APP_CONFIG.layout.pane.minCount) {
    return APP_CONFIG.layout.pane.minCount as PaneCount;
  }
  if (count > APP_CONFIG.layout.pane.maxCount) {
    return APP_CONFIG.layout.pane.maxCount as PaneCount;
  }
  return count as PaneCount;
}

function validateSidebarWidth(width: unknown): number {
  if (typeof width !== 'number' || !Number.isFinite(width)) {
    return APP_CONFIG.layout.sidebar.defaultExpandedWidth;
  }
  return Math.max(
    APP_CONFIG.layout.sidebar.minExpandedWidth,
    Math.min(APP_CONFIG.layout.sidebar.maxExpandedWidth, Math.floor(width))
  );
}

function validatePaneIndex(index: unknown, maxIndex: number): number | null {
  if (typeof index !== 'number' || !Number.isInteger(index)) {
    return null;
  }
  if (index < 0 || index > maxIndex) {
    return null;
  }
  return index;
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
  ipcMain.handle(IPC_CHANNELS.PANE_SET_COUNT, (_event, request: PaneCountRequest) => {
    if (!viewManager) {
      return { success: false };
    }
    const count = validatePaneCount(request?.count);
    viewManager.setPaneCount(count);
    setDefaultPaneCount(count);
    console.log('[IPC] pane:setCount', { count });
    return { success: true };
  });

  // Update provider for pane
  ipcMain.handle(IPC_CHANNELS.PANE_UPDATE_PROVIDER, (_event, request: PaneUpdateRequest) => {
    if (!viewManager) {
      return { success: false, paneIndex: request?.paneIndex ?? -1 };
    }
    const paneIndex = validatePaneIndex(request?.paneIndex, viewManager.getPaneCount() - 1);
    if (paneIndex === null) {
      console.error('[IPC] pane:updateProvider invalid paneIndex:', request?.paneIndex);
      return { success: false, paneIndex: request?.paneIndex ?? -1 };
    }
    const providerKey = typeof request?.providerKey === 'string' ? request.providerKey : '';
    const success = viewManager.updatePaneProvider(paneIndex, providerKey);
    if (success) {
      setDefaultProvider(paneIndex, providerKey);
    }
    console.log('[IPC] pane:updateProvider', { paneIndex, providerKey, success });
    return { success, paneIndex };
  });

  // Send prompt to all panes
  ipcMain.handle(IPC_CHANNELS.PROMPT_SEND, async (_event, request: PromptRequest) => {
    if (!viewManager) {
      return { success: false, failures: ['no-view-manager'] };
    }
    const text = typeof request?.text === 'string' ? request.text : '';
    const result = await viewManager.sendPromptToAll(text);
    console.log('[IPC] prompt:send', { textLength: text.length }, result);
    return result;
  });

  // Sync prompt draft to all panes (no submit)
  ipcMain.handle(IPC_CHANNELS.PROMPT_SYNC_DRAFT, async (_event, request: PromptSyncRequest) => {
    if (!viewManager) {
      return { success: false, failures: ['no-view-manager'] };
    }
    const text = typeof request?.text === 'string' ? request.text : '';
    const result = await viewManager.syncPromptDraftToAll(text);
    console.log('[IPC] prompt:syncDraft', { textLength: text.length }, result);
    return result;
  });

  // Layout update
  ipcMain.handle(IPC_CHANNELS.LAYOUT_UPDATE, (_event, request: LayoutUpdateRequest) => {
    if (!viewManager) {
      return { success: false };
    }
    const paneCount = validatePaneCount(request?.paneCount);
    const sidebarWidth = validateSidebarWidth(request?.sidebarWidth);
    viewManager.setPaneCount(paneCount);
    viewManager.updateLayout(sidebarWidth);
    console.log('[IPC] layout:update', { paneCount, sidebarWidth });
    return { success: true };
  });

  // Sidebar width update
  ipcMain.handle(IPC_CHANNELS.SIDEBAR_UPDATE_WIDTH, (_event, request: SidebarWidthRequest) => {
    if (!viewManager) {
      return { success: false };
    }
    const width = validateSidebarWidth(request?.width);
    viewManager.setSidebarWidth(width);
    console.log('[IPC] sidebar:updateWidth', { width });
    return { success: true };
  });

  // Quick prompt toggle
  ipcMain.handle(IPC_CHANNELS.QUICK_PROMPT_TOGGLE, () => {
    if (!viewManager) {
      return { success: false, visible: false };
    }
    const visible = viewManager.toggleQuickPrompt();
    return { success: true, visible };
  });

  // Quick prompt hide
  ipcMain.handle(IPC_CHANNELS.QUICK_PROMPT_HIDE, () => {
    if (!viewManager) {
      return { success: false, visible: false };
    }
    const visible = viewManager.hideQuickPrompt();
    return { success: true, visible };
  });

  // Quick prompt resize
  ipcMain.handle(IPC_CHANNELS.QUICK_PROMPT_RESIZE, (_event, request: QuickPromptResizeRequest) => {
    if (!viewManager) {
      return { success: false, visible: false, height: 0 };
    }
    const height = typeof request?.height === 'number' ? request.height : 0;
    const result = viewManager.resizeQuickPrompt(height);
    return { success: true, ...result };
  });

  // Listen for pane response ready (from pane webContents)
  ipcMain.on(IPC_CHANNELS.PANE_RESPONSE_READY, (_event, payload: PaneResponseReadyPayload) => {
    const paneIndex = typeof payload?.paneIndex === 'number' ? payload.paneIndex : -1;
    const response = typeof payload?.response === 'string' ? payload.response : '';
    console.log('[IPC] pane:responseReady', { paneIndex, responseLength: response.length });
    // TODO: Forward response to sidebar or store for later retrieval
  });
}

// App lifecycle
app.whenReady().then(() => {
  registerIPCHandlers();
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
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
