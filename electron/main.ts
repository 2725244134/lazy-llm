import { app, BaseWindow, ipcMain } from 'electron';
import { IPC_CHANNELS } from './ipc/contracts.js';
import type {
  PaneCountRequest,
  PaneUpdateRequest,
  PromptRequest,
  LayoutUpdateRequest,
  SidebarWidthRequest,
} from './ipc/contracts.js';
import { getConfig } from './ipc-handlers/store.js';
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
  });

  // Initialize ViewManager
  viewManager = new ViewManager(mainWindow);
  viewManager.initSidebar();

  // Set initial pane count from config
  const config = getConfig();
  const initialPaneCount = (config.defaults.pane_count || 2) as 1 | 2 | 3 | 4;
  viewManager.setPaneCount(initialPaneCount);

  // Update layout on window resize
  mainWindow.on('resize', () => {
    viewManager?.updateLayout();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    viewManager = null;
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    // DevTools for sidebar
    const snapshot = viewManager.getSnapshot();
    if (snapshot.panes.length > 0) {
      // Will be handled by sidebar's webContents
    }
  }
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
    viewManager.setPaneCount(request.count);
    console.log('[IPC] pane:setCount', request);
    return { success: true };
  });

  // Update provider for pane
  ipcMain.handle(IPC_CHANNELS.PANE_UPDATE_PROVIDER, (_event, request: PaneUpdateRequest) => {
    if (!viewManager) {
      return { success: false, paneIndex: request.paneIndex };
    }
    const success = viewManager.updatePaneProvider(request.paneIndex, request.providerKey);
    console.log('[IPC] pane:updateProvider', request, { success });
    return { success, paneIndex: request.paneIndex };
  });

  // Send prompt to all panes
  ipcMain.handle(IPC_CHANNELS.PROMPT_SEND, async (_event, request: PromptRequest) => {
    if (!viewManager) {
      return { success: false, failures: ['no-view-manager'] };
    }
    const result = await viewManager.sendPromptToAll(request.text);
    console.log('[IPC] prompt:send', request, result);
    return result;
  });

  // Layout update
  ipcMain.handle(IPC_CHANNELS.LAYOUT_UPDATE, (_event, request: LayoutUpdateRequest) => {
    if (!viewManager) {
      return { success: false };
    }
    viewManager.setPaneCount(request.paneCount);
    viewManager.updateLayout(request.sidebarWidth);
    console.log('[IPC] layout:update', request);
    return { success: true };
  });

  // Get layout snapshot
  ipcMain.handle(IPC_CHANNELS.LAYOUT_GET_SNAPSHOT, () => {
    if (!viewManager) {
      return {
        windowWidth: 0,
        windowHeight: 0,
        sidebar: { x: 0, y: 0, width: 0, height: 0 },
        paneCount: 1,
        panes: [],
      };
    }
    return viewManager.getSnapshot();
  });

  // Sidebar width update
  ipcMain.handle(IPC_CHANNELS.SIDEBAR_UPDATE_WIDTH, (_event, request: SidebarWidthRequest) => {
    if (!viewManager) {
      return { success: false };
    }
    viewManager.setSidebarWidth(request.width);
    console.log('[IPC] sidebar:updateWidth', request);
    return { success: true };
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
