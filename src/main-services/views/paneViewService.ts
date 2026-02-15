import {
  BaseWindow,
  Menu,
  type ContextMenuParams,
  type Event,
  type Input,
  WebContentsView,
  type WebContents,
} from 'electron';
import type { PaneViewState } from './paneLifecycleService.js';
import type { PaneLoadMonitor } from './paneLoadMonitor.js';
import { resolveShortcutAction, type ShortcutAction } from './shortcutDispatcher.js';

type PaneShortcutAction = Exclude<ShortcutAction, 'noop'>;
export type PaneUserAgentStrategy = 'default' | 'chrome';
const ELECTRON_USER_AGENT_SEGMENT = /\sElectron\/[^\s]+/g;
const CHROME_FALLBACK_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

interface PaneViewServiceOptions {
  hostWindow: BaseWindow;
  panePreloadPath: string;
  paneSessionPartition: string;
  paneUserAgentStrategy: PaneUserAgentStrategy;
  paneAcceptLanguages: string;
  paneZoomFactor: number;
  paneLoadMonitor: Pick<PaneLoadMonitor, 'attachPane' | 'markTarget' | 'clear' | 'clearAll'>;
  onPaneShortcutAction(action: PaneShortcutAction, sourceWebContents: WebContents): void;
  setQuickPromptAnchorPaneIndex(paneIndex: number): void;
  beginProviderLoadingTracking(paneIndex: number, webContents: WebContents): void;
  removePaneViewFromContent(view: WebContentsView): void;
  createPaneContextMenu?(
    webContents: WebContents,
    params: ContextMenuParams
  ): Pick<Menu, 'popup'>;
  onPaneLoadUrlError?(paneIndex: number, targetUrl: string, error: unknown): void;
  createPaneView?(paneIndex: number): WebContentsView;
}

export class PaneViewService {
  constructor(private readonly options: PaneViewServiceOptions) {}

  createPaneWebContentsView(paneIndex: number): WebContentsView {
    const view = this.options.createPaneView
      ? this.options.createPaneView(paneIndex)
      : new WebContentsView({
          webPreferences: {
            preload: this.options.panePreloadPath,
            partition: this.options.paneSessionPartition,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            additionalArguments: [`--pane-index=${paneIndex}`],
          },
        });

    this.attachPaneShortcutHooks(view.webContents);
    this.attachPaneContextMenuHooks(view.webContents);
    this.attachPaneRuntimePreferenceHooks(view.webContents);
    this.attachPaneDebugConsoleHooks(paneIndex, view.webContents);
    this.options.paneLoadMonitor.attachPane(paneIndex, view.webContents);
    view.webContents.on('focus', () => {
      this.options.setQuickPromptAnchorPaneIndex(paneIndex);
    });
    this.applyPaneRuntimePreferences(view.webContents);

    return view;
  }

  applyPaneRuntimePreferences(webContents: WebContents): void {
    const rawUserAgent = webContents.getUserAgent();
    const paneUserAgent = buildPaneUserAgent(this.options.paneUserAgentStrategy, rawUserAgent);
    webContents.session.setUserAgent(paneUserAgent, this.options.paneAcceptLanguages);
    webContents.setZoomFactor(this.options.paneZoomFactor);
  }

  loadPaneUrl(
    paneIndex: number,
    view: WebContentsView,
    targetUrl: string,
    trackLoading: boolean
  ): void {
    this.options.paneLoadMonitor.markTarget(view.webContents.id, targetUrl);
    if (trackLoading) {
      this.options.beginProviderLoadingTracking(paneIndex, view.webContents);
    }
    view.webContents.loadURL(targetUrl).catch((error) => {
      if (this.options.onPaneLoadUrlError) {
        this.options.onPaneLoadUrlError(paneIndex, targetUrl, error);
        return;
      }
      console.error(`[PaneViewService] Failed to load URL for pane ${paneIndex}: ${targetUrl}`, error);
    });
  }

  removePaneViewFromContent(view: WebContentsView): void {
    try {
      this.options.removePaneViewFromContent(view);
    } catch {
      // The view may already be detached from the content tree.
    }
  }

  closePane(pane: PaneViewState): void {
    const uniqueViews = new Set<WebContentsView>();
    for (const cached of pane.cachedViews.values()) {
      uniqueViews.add(cached.view);
    }
    uniqueViews.add(pane.view);

    for (const view of uniqueViews) {
      this.removePaneViewFromContent(view);
      if (!view.webContents.isDestroyed()) {
        this.options.paneLoadMonitor.clear(view.webContents.id);
        view.webContents.close();
      }
    }
  }

  clearAllPaneLoadState(): void {
    this.options.paneLoadMonitor.clearAll();
  }

  private attachPaneRuntimePreferenceHooks(webContents: WebContents): void {
    webContents.on('did-finish-load', () => {
      this.applyPaneRuntimePreferences(webContents);
    });
  }

  private attachPaneDebugConsoleHooks(paneIndex: number, webContents: WebContents): void {
    webContents.on('console-message', (_event, level, message, line, sourceId) => {
      if (typeof message !== 'string' || !message.includes('[QuickPromptDebug]')) {
        return;
      }
      console.info('[QuickPromptDebug][PaneConsole]', {
        paneIndex,
        webContentsId: webContents.id,
        level,
        message,
        line,
        sourceId,
      });
    });
  }

  private attachPaneShortcutHooks(webContents: WebContents): void {
    webContents.on('before-input-event', (event: Event, input: Input) => {
      const action = resolveShortcutAction({
        type: input.type,
        isAutoRepeat: input.isAutoRepeat,
        key: input.key,
        control: input.control,
        meta: input.meta,
        alt: input.alt,
        shift: input.shift,
      });
      if (action === 'noop') {
        return;
      }
      event.preventDefault();
      this.options.onPaneShortcutAction(action, webContents);
    });
  }

  private attachPaneContextMenuHooks(webContents: WebContents): void {
    webContents.on('context-menu', (_event: Event, params: ContextMenuParams) => {
      if (webContents.isDestroyed()) {
        return;
      }
      const menu = this.options.createPaneContextMenu
        ? this.options.createPaneContextMenu(webContents, params)
        : this.buildPaneContextMenu(webContents, params);
      menu.popup({
        window: this.options.hostWindow,
        frame: params.frame ?? undefined,
        x: Math.floor(params.x),
        y: Math.floor(params.y),
        sourceType: params.menuSourceType,
      });
    });
  }

  private buildPaneContextMenu(
    webContents: WebContents,
    params: ContextMenuParams
  ): Menu {
    const canGoBack = webContents.navigationHistory.canGoBack();
    const canGoForward = webContents.navigationHistory.canGoForward();
    const inspectX = Math.floor(params.x);
    const inspectY = Math.floor(params.y);

    return Menu.buildFromTemplate([
      {
        label: 'Back',
        enabled: canGoBack,
        click: () => {
          if (!webContents.isDestroyed() && webContents.navigationHistory.canGoBack()) {
            webContents.navigationHistory.goBack();
          }
        },
      },
      {
        label: 'Forward',
        enabled: canGoForward,
        click: () => {
          if (!webContents.isDestroyed() && webContents.navigationHistory.canGoForward()) {
            webContents.navigationHistory.goForward();
          }
        },
      },
      {
        label: 'Reload',
        click: () => {
          if (!webContents.isDestroyed()) {
            webContents.reload();
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Inspect',
        click: () => {
          if (!webContents.isDestroyed()) {
            webContents.inspectElement(inspectX, inspectY);
          }
        },
      },
    ]);
  }
}

export function buildPaneUserAgent(
  strategy: PaneUserAgentStrategy,
  rawUserAgent: string
): string {
  if (strategy === 'default') {
    return rawUserAgent;
  }

  const normalized = rawUserAgent.trim().replace(ELECTRON_USER_AGENT_SEGMENT, '').trim();
  if (normalized.includes('Chrome/')) {
    return normalized;
  }
  return CHROME_FALLBACK_USER_AGENT;
}
