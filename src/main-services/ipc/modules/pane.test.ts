import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_CONFIG } from '@shared-config/src/app.js';
import { IPC_CHANNELS, type AppConfig } from '@shared-contracts/ipc/contracts';
import type { IpcRuntimeContext } from '../context.js';
import { registerPaneIpcHandlers } from './pane';

type PaneHandler = (event: unknown, request?: unknown) => unknown;

interface PaneViewManagerLike {
  getPaneCount(): number;
  setPaneCount(count: number): void;
  resetAllPanesToProviderHome(): boolean;
  updatePaneProvider(paneIndex: number, providerKey: string): boolean;
  activateTabSession(tabId: string, paneCount: number, paneProviders: readonly string[]): boolean;
  closeTabSession(tabId: string): boolean;
}

const electronMocks = vi.hoisted(() => {
  const handlers = new Map<string, PaneHandler>();
  const handle = vi.fn((channel: string, handler: PaneHandler) => {
    handlers.set(channel, handler);
  });
  const on = vi.fn();
  return {
    handlers,
    handle,
    on,
  };
});

vi.mock('electron', () => ({
  ipcMain: {
    handle: electronMocks.handle,
    on: electronMocks.on,
  },
}));

function createContext(viewManager: PaneViewManagerLike | null): IpcRuntimeContext {
  return {
    getViewManager: () => viewManager as ReturnType<IpcRuntimeContext['getViewManager']>,
    getConfig: () => ({} as AppConfig),
    setDefaultPaneCount: () => undefined,
    setDefaultProvider: () => undefined,
  };
}

function createViewManagerMock(overrides?: Partial<PaneViewManagerLike>): PaneViewManagerLike {
  return {
    getPaneCount: vi.fn(() => APP_CONFIG.layout.pane.defaultCount),
    setPaneCount: vi.fn(),
    resetAllPanesToProviderHome: vi.fn(() => true),
    updatePaneProvider: vi.fn(() => true),
    activateTabSession: vi.fn(() => true),
    closeTabSession: vi.fn(() => true),
    ...overrides,
  };
}

function getHandler(channel: string): PaneHandler {
  const handler = electronMocks.handlers.get(channel);
  if (!handler) {
    throw new Error(`Handler not registered for channel: ${channel}`);
  }
  return handler;
}

describe('registerPaneIpcHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    electronMocks.handlers.clear();
  });

  it('registers pane and tab handlers', () => {
    registerPaneIpcHandlers(createContext(null));

    expect(electronMocks.handle).toHaveBeenCalledTimes(5);
    expect(electronMocks.handlers.has(IPC_CHANNELS.PANE_SET_COUNT)).toBe(true);
    expect(electronMocks.handlers.has(IPC_CHANNELS.PANE_RESET_ALL)).toBe(true);
    expect(electronMocks.handlers.has(IPC_CHANNELS.PANE_UPDATE_PROVIDER)).toBe(true);
    expect(electronMocks.handlers.has(IPC_CHANNELS.SIDEBAR_ACTIVATE_TAB)).toBe(true);
    expect(electronMocks.handlers.has(IPC_CHANNELS.SIDEBAR_CLOSE_TAB)).toBe(true);
  });

  it('activates tab session with normalized payload', () => {
    const viewManager = createViewManagerMock();
    registerPaneIpcHandlers(createContext(viewManager));

    const activateHandler = getHandler(IPC_CHANNELS.SIDEBAR_ACTIVATE_TAB);
    const response = activateHandler({}, {
      tabId: '  tab-2 ',
      paneCount: APP_CONFIG.layout.pane.maxCount + 8,
      paneProviders: [' chatgpt ', '', null, 'gemini'],
    });

    expect(response).toEqual({ success: true });
    expect(viewManager.activateTabSession).toHaveBeenCalledWith(
      'tab-2',
      APP_CONFIG.layout.pane.maxCount,
      ['chatgpt', 'gemini'],
    );
  });

  it('returns failure for invalid tab id on activate/close', () => {
    const viewManager = createViewManagerMock();
    registerPaneIpcHandlers(createContext(viewManager));

    const activateHandler = getHandler(IPC_CHANNELS.SIDEBAR_ACTIVATE_TAB);
    const closeHandler = getHandler(IPC_CHANNELS.SIDEBAR_CLOSE_TAB);

    expect(activateHandler({}, { tabId: '   ', paneCount: 2, paneProviders: ['chatgpt'] })).toEqual({
      success: false,
    });
    expect(closeHandler({}, { tabId: '' })).toEqual({ success: false });
    expect(viewManager.activateTabSession).not.toHaveBeenCalled();
    expect(viewManager.closeTabSession).not.toHaveBeenCalled();
  });

  it('closes tab session through view manager', () => {
    const viewManager = createViewManagerMock({
      closeTabSession: vi.fn(() => false),
    });
    registerPaneIpcHandlers(createContext(viewManager));

    const closeHandler = getHandler(IPC_CHANNELS.SIDEBAR_CLOSE_TAB);
    const response = closeHandler({}, { tabId: 'tab-5' });

    expect(response).toEqual({ success: false });
    expect(viewManager.closeTabSession).toHaveBeenCalledWith('tab-5');
  });
});

