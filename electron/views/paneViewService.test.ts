import { describe, expect, it, vi } from 'vitest';
import type { WebContents, WebContentsView } from 'electron';
import type { PaneViewState } from './paneLifecycleService';
import { PaneViewService } from './paneViewService';

type PaneHookEvent =
  | 'did-finish-load'
  | 'focus';

type FakePaneWebContents = WebContents & {
  __emit(event: PaneHookEvent): void;
};

function createFakePaneWebContents(id: number): FakePaneWebContents {
  const listeners = new Map<PaneHookEvent, Array<() => void>>();
  const getUserAgent = vi.fn(() => 'fake-user-agent');
  const setUserAgent = vi.fn();
  const setZoomFactor = vi.fn();
  const loadURL = vi.fn(() => Promise.resolve(undefined));
  const close = vi.fn();
  const isDestroyed = vi.fn(() => false);

  const webContents = {
    id,
    session: {
      setUserAgent,
    },
    getUserAgent,
    setZoomFactor,
    loadURL,
    close,
    isDestroyed,
    on: vi.fn((event: PaneHookEvent, listener: () => void) => {
      const eventListeners = listeners.get(event) ?? [];
      eventListeners.push(listener);
      listeners.set(event, eventListeners);
    }),
    __emit(event: PaneHookEvent) {
      for (const listener of listeners.get(event) ?? []) {
        listener();
      }
    },
  };

  return webContents as unknown as FakePaneWebContents;
}

function createFakePaneView(webContentsId: number): WebContentsView {
  return {
    webContents: createFakePaneWebContents(webContentsId),
    setBounds: vi.fn(),
  } as unknown as WebContentsView;
}

function createHarness() {
  const monitor = {
    attachPane: vi.fn<(paneIndex: number, webContents: WebContents) => void>(),
    markTarget: vi.fn<(webContentsId: number, targetUrl: string) => void>(),
    clear: vi.fn<(webContentsId: number) => void>(),
    clearAll: vi.fn<() => void>(),
  };
  const attachGlobalShortcutHooks = vi.fn<(webContents: WebContents) => void>();
  const attachPaneContextMenuHooks = vi.fn<(webContents: WebContents) => void>();
  const setQuickPromptAnchorPaneIndex = vi.fn<(paneIndex: number) => void>();
  const beginProviderLoadingTracking = vi.fn<(paneIndex: number, webContents: WebContents) => void>();
  const removePaneViewFromContent = vi.fn<(view: WebContentsView) => void>();
  const onPaneLoadUrlError = vi.fn<(paneIndex: number, targetUrl: string, error: unknown) => void>();
  const viewFactory = vi.fn<(paneIndex: number) => WebContentsView>((paneIndex) => {
    return createFakePaneView(100 + paneIndex);
  });

  const service = new PaneViewService({
    panePreloadPath: '/tmp/pane-preload.cjs',
    paneAcceptLanguages: 'en-US,en',
    paneZoomFactor: 1.1,
    paneLoadMonitor: monitor,
    attachGlobalShortcutHooks,
    attachPaneContextMenuHooks,
    setQuickPromptAnchorPaneIndex,
    beginProviderLoadingTracking,
    removePaneViewFromContent,
    onPaneLoadUrlError,
    createPaneView: viewFactory,
  });

  return {
    service,
    monitor,
    attachGlobalShortcutHooks,
    attachPaneContextMenuHooks,
    setQuickPromptAnchorPaneIndex,
    beginProviderLoadingTracking,
    removePaneViewFromContent,
    onPaneLoadUrlError,
    viewFactory,
  };
}

describe('PaneViewService', () => {
  it('creates pane view and wires hooks/monitor/runtime preferences', () => {
    const {
      service,
      monitor,
      attachGlobalShortcutHooks,
      attachPaneContextMenuHooks,
      setQuickPromptAnchorPaneIndex,
      viewFactory,
    } = createHarness();

    const view = service.createPaneWebContentsView(2);
    const paneContents = view.webContents as FakePaneWebContents;

    expect(viewFactory).toHaveBeenCalledWith(2);
    expect(attachGlobalShortcutHooks).toHaveBeenCalledWith(paneContents);
    expect(attachPaneContextMenuHooks).toHaveBeenCalledWith(paneContents);
    expect(monitor.attachPane).toHaveBeenCalledWith(2, paneContents);
    expect(paneContents.session.setUserAgent).toHaveBeenCalledWith('fake-user-agent', 'en-US,en');
    expect(paneContents.setZoomFactor).toHaveBeenCalledWith(1.1);

    paneContents.__emit('focus');
    expect(setQuickPromptAnchorPaneIndex).toHaveBeenCalledWith(2);

    paneContents.__emit('did-finish-load');
    expect(paneContents.setZoomFactor).toHaveBeenCalledTimes(2);
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
