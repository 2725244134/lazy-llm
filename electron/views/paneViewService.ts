import { WebContentsView, type WebContents } from 'electron';
import type { PaneViewState } from './paneLifecycleService.js';
import type { PaneLoadMonitor } from './paneLoadMonitor.js';

interface PaneViewServiceOptions {
  panePreloadPath: string;
  paneAcceptLanguages: string;
  paneZoomFactor: number;
  paneLoadMonitor: Pick<PaneLoadMonitor, 'attachPane' | 'markTarget' | 'clear' | 'clearAll'>;
  attachGlobalShortcutHooks(webContents: WebContents): void;
  attachPaneContextMenuHooks(webContents: WebContents): void;
  setQuickPromptAnchorPaneIndex(paneIndex: number): void;
  beginProviderLoadingTracking(paneIndex: number, webContents: WebContents): void;
  removePaneViewFromContent(view: WebContentsView): void;
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
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            additionalArguments: [`--pane-index=${paneIndex}`],
          },
        });

    this.options.attachGlobalShortcutHooks(view.webContents);
    this.options.attachPaneContextMenuHooks(view.webContents);
    this.attachPaneRuntimePreferenceHooks(view.webContents);
    this.options.paneLoadMonitor.attachPane(paneIndex, view.webContents);
    view.webContents.on('focus', () => {
      this.options.setQuickPromptAnchorPaneIndex(paneIndex);
    });
    this.applyPaneRuntimePreferences(view.webContents);

    return view;
  }

  applyPaneRuntimePreferences(webContents: WebContents): void {
    const rawUserAgent = webContents.getUserAgent();
    webContents.session.setUserAgent(rawUserAgent, this.options.paneAcceptLanguages);
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
}
