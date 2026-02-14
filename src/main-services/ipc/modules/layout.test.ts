import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_CONFIG } from '@shared-config/src/app.js';
import { IPC_CHANNELS, type AppConfig } from '@shared-contracts/ipc/contracts';
import type { IpcRuntimeContext } from '../context.js';
import { registerLayoutIpcHandlers } from './layout';

type LayoutHandler = (event: unknown, request: unknown) => { success: boolean };

interface LayoutViewManagerLike {
  getPaneCount(): number;
  setPaneCount(count: number): void;
  updateLayout(sidebarWidth: number): void;
  setSidebarWidth(width: number): void;
}

const electronMocks = vi.hoisted(() => {
  const handlers = new Map<string, LayoutHandler>();
  const handle = vi.fn((channel: string, handler: LayoutHandler) => {
    handlers.set(channel, handler);
  });
  return {
    handlers,
    handle,
  };
});

vi.mock('electron', () => ({
  ipcMain: {
    handle: electronMocks.handle,
  },
}));

const emptyConfig = {} as AppConfig;

function createContext(viewManager: LayoutViewManagerLike | null): IpcRuntimeContext {
  return {
    getViewManager: () => viewManager as ReturnType<IpcRuntimeContext['getViewManager']>,
    getConfig: () => emptyConfig,
    setDefaultPaneCount: () => undefined,
    setDefaultProvider: () => undefined,
  };
}

function getHandler(channel: string): LayoutHandler {
  const handler = electronMocks.handlers.get(channel);
  if (!handler) {
    throw new Error(`Handler not registered for channel: ${channel}`);
  }
  return handler;
}

function createViewManagerMock(overrides?: Partial<LayoutViewManagerLike>): LayoutViewManagerLike {
  return {
    getPaneCount: vi.fn(() => APP_CONFIG.layout.pane.defaultCount),
    setPaneCount: vi.fn(),
    updateLayout: vi.fn(),
    setSidebarWidth: vi.fn(),
    ...overrides,
  };
}

describe('registerLayoutIpcHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    electronMocks.handlers.clear();
  });

  it('registers layout and sidebar width handlers', () => {
    registerLayoutIpcHandlers(createContext(null));

    expect(electronMocks.handle).toHaveBeenCalledTimes(2);
    expect(electronMocks.handlers.has(IPC_CHANNELS.LAYOUT_UPDATE)).toBe(true);
    expect(electronMocks.handlers.has(IPC_CHANNELS.SIDEBAR_UPDATE_WIDTH)).toBe(true);
  });

  it('returns failure when layout handler has no active view manager', () => {
    registerLayoutIpcHandlers(createContext(null));

    const layoutHandler = getHandler(IPC_CHANNELS.LAYOUT_UPDATE);
    expect(layoutHandler(undefined, { paneCount: 2, sidebarWidth: 320 })).toEqual({ success: false });
  });

  it('skips setPaneCount when pane count is unchanged', () => {
    const viewManager = createViewManagerMock({
      getPaneCount: vi.fn(() => APP_CONFIG.layout.pane.defaultCount),
    });
    registerLayoutIpcHandlers(createContext(viewManager));

    const requestedWidth = APP_CONFIG.layout.sidebar.defaultExpandedWidth + 33;
    const layoutHandler = getHandler(IPC_CHANNELS.LAYOUT_UPDATE);
    const response = layoutHandler(undefined, {
      paneCount: APP_CONFIG.layout.pane.defaultCount,
      sidebarWidth: requestedWidth,
    });

    expect(response).toEqual({ success: true });
    expect(viewManager.getPaneCount).toHaveBeenCalledTimes(1);
    expect(viewManager.setPaneCount).not.toHaveBeenCalled();
    expect(viewManager.updateLayout).toHaveBeenCalledWith(requestedWidth);
  });

  it('updates pane count and clamps values when request exceeds bounds', () => {
    const viewManager = createViewManagerMock({
      getPaneCount: vi.fn(() => APP_CONFIG.layout.pane.minCount),
    });
    registerLayoutIpcHandlers(createContext(viewManager));

    const layoutHandler = getHandler(IPC_CHANNELS.LAYOUT_UPDATE);
    const response = layoutHandler(undefined, {
      paneCount: APP_CONFIG.layout.pane.maxCount + 99,
      sidebarWidth: APP_CONFIG.layout.sidebar.maxExpandedWidth + 999,
    });

    expect(response).toEqual({ success: true });
    expect(viewManager.setPaneCount).toHaveBeenCalledWith(APP_CONFIG.layout.pane.maxCount);
    expect(viewManager.updateLayout).toHaveBeenCalledWith(APP_CONFIG.layout.sidebar.maxExpandedWidth);
  });

  it('returns failure when sidebar width handler has no active view manager', () => {
    registerLayoutIpcHandlers(createContext(null));

    const sidebarWidthHandler = getHandler(IPC_CHANNELS.SIDEBAR_UPDATE_WIDTH);
    expect(sidebarWidthHandler(undefined, { width: 200 })).toEqual({ success: false });
  });

  it('clamps sidebar width before dispatching to view manager', () => {
    const viewManager = createViewManagerMock();
    registerLayoutIpcHandlers(createContext(viewManager));

    const sidebarWidthHandler = getHandler(IPC_CHANNELS.SIDEBAR_UPDATE_WIDTH);
    const response = sidebarWidthHandler(undefined, { width: -10 });

    expect(response).toEqual({ success: true });
    expect(viewManager.setSidebarWidth).toHaveBeenCalledWith(APP_CONFIG.layout.sidebar.minExpandedWidth);
  });
});
