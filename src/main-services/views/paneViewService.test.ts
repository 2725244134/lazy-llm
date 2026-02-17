import { describe, expect, it, vi } from 'vitest';
import type { BaseWindow, WebContents, WebContentsView } from 'electron';
import type { PaneViewState } from './paneLifecycleService';
import { buildPaneUserAgent, PaneViewService } from './paneViewService';

type PaneHookEvent =
  | 'did-finish-load'
  | 'focus'
  | 'before-input-event'
  | 'context-menu'
  | 'console-message';

type PaneHookListeners = {
  [event in PaneHookEvent]: Array<(...args: unknown[]) => void>;
};

type FakePaneWebContents = WebContents & {
  __emit(event: PaneHookEvent, ...args: unknown[]): void;
};

function createFakePaneWebContents(id: number): FakePaneWebContents {
  const listeners: PaneHookListeners = {
    'did-finish-load': [],
    focus: [],
    'before-input-event': [],
    'context-menu': [],
    'console-message': [],
  };
  const getUserAgent = vi.fn(() => 'fake-user-agent');
  const setUserAgent = vi.fn();
  const setZoomFactor = vi.fn();
  const loadURL = vi.fn(() => Promise.resolve(undefined));
  const close = vi.fn();
  const isDestroyed = vi.fn(() => false);
  const canGoBack = vi.fn(() => false);
  const canGoForward = vi.fn(() => false);
  const goBack = vi.fn();
  const goForward = vi.fn();
  const reload = vi.fn();
  const inspectElement = vi.fn();

  const webContents = {
    id,
    session: {
      setUserAgent,
    },
    getUserAgent,
    setZoomFactor,
    loadURL,
    close,
    reload,
    inspectElement,
    isDestroyed,
    navigationHistory: {
      canGoBack,
      canGoForward,
      goBack,
      goForward,
    },
    on: vi.fn((event: PaneHookEvent, listener: (...args: unknown[]) => void) => {
      listeners[event].push(listener);
    }),
    __emit(event: PaneHookEvent, ...args: unknown[]) {
      for (const listener of listeners[event]) {
        listener(...args);
      }
    },
  };

  return webContents as unknown as FakePaneWebContents;
}

function createFakePaneView(webContentsId: number): WebContentsView {
  return {
    webContents: createFakePaneWebContents(webContentsId),
    setBounds: vi.fn(),
    getBounds: vi.fn(() => ({ x: 160, y: 24, width: 1024, height: 768 })),
  } as unknown as WebContentsView;
}

function createHarness() {
  const monitor = {
    attachPane: vi.fn<(paneIndex: number, webContents: WebContents) => void>(),
    markTarget: vi.fn<(webContentsId: number, targetUrl: string) => void>(),
    clear: vi.fn<(webContentsId: number) => void>(),
    clearAll: vi.fn<() => void>(),
  };
  const hostWindow = {} as BaseWindow;
  const onPaneShortcutAction = vi.fn<(action: 'toggleQuickPrompt' | 'notifySidebarToggle' | 'resetAllPanes', sourceWebContents: WebContents) => void>();
  const setQuickPromptAnchorPaneIndex = vi.fn<(paneIndex: number) => void>();
  const beginProviderLoadingTracking = vi.fn<(paneIndex: number, webContents: WebContents) => void>();
  const removePaneViewFromContent = vi.fn<(view: WebContentsView) => void>();
  const contextMenuPopup = vi.fn();
  const createPaneContextMenu = vi.fn<(webContents: WebContents, params: unknown) => { popup: typeof contextMenuPopup }>(
    () => ({ popup: contextMenuPopup })
  );
  const onPaneLoadUrlError = vi.fn<(paneIndex: number, targetUrl: string, error: unknown) => void>();
  const viewFactory = vi.fn<(paneIndex: number) => WebContentsView>((paneIndex) => {
    return createFakePaneView(100 + paneIndex);
  });

  const service = new PaneViewService({
    hostWindow,
    panePreloadPath: '/tmp/pane-preload.cjs',
    paneSessionPartition: 'persist:test-panes',
    paneUserAgentStrategy: 'default',
    paneAcceptLanguages: 'en-US,en',
    paneZoomFactor: 1.1,
    paneLoadMonitor: monitor,
    onPaneShortcutAction,
    setQuickPromptAnchorPaneIndex,
    beginProviderLoadingTracking,
    removePaneViewFromContent,
    createPaneContextMenu,
    onPaneLoadUrlError,
    createPaneView: viewFactory,
  });

  return {
    service,
    monitor,
    hostWindow,
    onPaneShortcutAction,
    setQuickPromptAnchorPaneIndex,
    beginProviderLoadingTracking,
    removePaneViewFromContent,
    createPaneContextMenu,
    contextMenuPopup,
    onPaneLoadUrlError,
    viewFactory,
  };
}

describe('PaneViewService', () => {
  it('creates pane view and wires hooks/monitor/runtime preferences', () => {
    const {
      service,
      monitor,
      setQuickPromptAnchorPaneIndex,
      viewFactory,
    } = createHarness();

    const view = service.createPaneWebContentsView(2);
    const paneContents = view.webContents as FakePaneWebContents;

    expect(viewFactory).toHaveBeenCalledWith(2);
    expect(monitor.attachPane).toHaveBeenCalledWith(2, paneContents);
    expect(paneContents.session.setUserAgent).toHaveBeenCalledWith('fake-user-agent', 'en-US,en');
    expect(paneContents.setZoomFactor).toHaveBeenCalledWith(1.1);

    paneContents.__emit('focus');
    expect(setQuickPromptAnchorPaneIndex).toHaveBeenCalledWith(2);

    paneContents.__emit('did-finish-load');
    expect(paneContents.setZoomFactor).toHaveBeenCalledTimes(2);
  });

  it('dispatches pane shortcut actions with preventDefault', () => {
    const { service, onPaneShortcutAction } = createHarness();
    const view = service.createPaneWebContentsView(1);
    const paneContents = view.webContents as FakePaneWebContents;
    const preventDefault = vi.fn();

    paneContents.__emit(
      'before-input-event',
      { preventDefault },
      {
        type: 'keyDown',
        key: 'j',
        control: true,
        meta: false,
        alt: false,
        shift: false,
        isAutoRepeat: false,
      }
    );

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(onPaneShortcutAction).toHaveBeenCalledWith('toggleQuickPrompt', paneContents);
  });

  it('builds and pops pane context menu using host-window coordinates', () => {
    const { service, createPaneContextMenu, contextMenuPopup, hostWindow } = createHarness();
    const view = service.createPaneWebContentsView(0);
    const paneContents = view.webContents as FakePaneWebContents;
    const params = {
      x: 12.9,
      y: 44.1,
      frame: null,
      menuSourceType: 'mouse',
    };

    paneContents.__emit('context-menu', {}, params);

    expect(createPaneContextMenu).toHaveBeenCalledWith(paneContents, params);
    expect(contextMenuPopup).toHaveBeenCalledWith({
      window: hostWindow,
      frame: undefined,
      x: 172,
      y: 68,
      sourceType: 'mouse',
    });
  });

  it('marks target and starts provider loading tracking when loading pane URL', async () => {
    const {
      service,
      monitor,
      beginProviderLoadingTracking,
    } = createHarness();
    const view = service.createPaneWebContentsView(0);
    const paneContents = view.webContents as FakePaneWebContents;

    service.loadPaneUrl(0, view, 'https://example.com', true);
    await Promise.resolve();

    expect(monitor.markTarget).toHaveBeenCalledWith(paneContents.id, 'https://example.com');
    expect(beginProviderLoadingTracking).toHaveBeenCalledWith(0, paneContents);
    expect(paneContents.loadURL).toHaveBeenCalledWith('https://example.com');
  });

  it('closes unique pane views and clears monitor state', () => {
    const {
      service,
      monitor,
      removePaneViewFromContent,
    } = createHarness();

    const primaryView = service.createPaneWebContentsView(0);
    const secondaryView = service.createPaneWebContentsView(1);
    const paneState: PaneViewState = {
      view: primaryView,
      paneIndex: 0,
      providerKey: 'chatgpt',
      url: 'https://chatgpt.com',
      cachedViews: new Map([
        ['chatgpt', { view: primaryView, url: 'https://chatgpt.com' }],
        ['claude', { view: secondaryView, url: 'https://claude.ai' }],
      ]),
    };

    service.closePane(paneState);

    expect(removePaneViewFromContent).toHaveBeenCalledTimes(2);
    expect(monitor.clear).toHaveBeenCalledTimes(2);
    expect((primaryView.webContents as FakePaneWebContents).close).toHaveBeenCalledTimes(1);
    expect((secondaryView.webContents as FakePaneWebContents).close).toHaveBeenCalledTimes(1);
  });
});

describe('buildPaneUserAgent', () => {
  it('returns original user agent for default strategy', () => {
    const raw = 'Mozilla/5.0 Chrome/132.0.0.0 Electron/38.0.0 Safari/537.36';
    expect(buildPaneUserAgent('default', raw)).toBe(raw);
  });

  it('strips Electron marker for chrome strategy', () => {
    const raw = 'Mozilla/5.0 Chrome/132.0.0.0 Electron/38.0.0 Safari/537.36';
    const result = buildPaneUserAgent('chrome', raw);
    expect(result).not.toContain('Electron/');
    expect(result).toContain('Chrome/');
  });
});
