/**
 * ViewManager - manages sidebar and pane WebContentsViews
 */

import {
  BaseWindow,
  Menu,
  type ContextMenuParams,
  type Event,
  type Input,
  type WebContents,
  WebContentsView,
  webContents,
} from 'electron';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { APP_CONFIG } from '../../src/config/app.js';
import { type LayoutResult } from './geometry.js';
import { LayoutService } from './layoutService.js';
import { PaneLoadMonitor, areUrlsEquivalent } from './paneLoadMonitor.js';
import {
  type PaneViewState,
  resetAllPanesToProviderHomeWithLifecycle,
  setPaneCountWithLifecycle,
  updatePaneProviderWithLifecycle,
} from './paneLifecycleService.js';
import { PromptDispatchService } from './promptDispatchService.js';
import { buildQuickPromptDataUrl } from './quick-prompt/index.js';
import { resolveShortcutAction } from './shortcutDispatcher.js';
import { SidebarEventBridge } from './sidebarEventBridge.js';
import {
  PANE_ACCEPT_LANGUAGES,
} from './paneRuntimePreferences.js';
import type { RuntimePreferences } from '../ipc-handlers/externalConfig.js';
import { padProviderSequence } from '../ipc-handlers/providerConfig.js';
import type {
  AppConfig,
  PaneCount,
  ProviderMeta,
} from '../ipc/contracts.js';

const runtimeDir = fileURLToPath(new URL('.', import.meta.url));

function resolveFirstExistingPath(candidates: string[]): string {
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
}

const sidebarPreloadPath = resolveFirstExistingPath([
  join(runtimeDir, 'preload.cjs'),
  join(runtimeDir, 'preload.js'),
  join(runtimeDir, 'preload.mjs'),
  join(runtimeDir, '..', 'preload.cjs'),
  join(runtimeDir, '..', 'preload.js'),
  join(runtimeDir, '..', 'preload.mjs'),
]);

const panePreloadPath = resolveFirstExistingPath([
  join(runtimeDir, 'pane-preload.cjs'),
  join(runtimeDir, 'pane-preload.js'),
  join(runtimeDir, 'pane-preload.mjs'),
  join(runtimeDir, '..', 'pane-preload.cjs'),
  join(runtimeDir, '..', 'pane-preload.js'),
  join(runtimeDir, '..', 'pane-preload.mjs'),
]);

const quickPromptPreloadPath = resolveFirstExistingPath([
  join(runtimeDir, 'quick-prompt-preload.cjs'),
  join(runtimeDir, 'quick-prompt-preload.js'),
  join(runtimeDir, 'quick-prompt-preload.mjs'),
  join(runtimeDir, '..', 'quick-prompt-preload.cjs'),
  join(runtimeDir, '..', 'quick-prompt-preload.js'),
  join(runtimeDir, '..', 'quick-prompt-preload.mjs'),
]);

const rendererIndexPath = resolveFirstExistingPath([
  join(runtimeDir, '..', 'dist', 'index.html'),
  join(runtimeDir, '..', '..', 'dist', 'index.html'),
]);

const injectRuntimePath = resolveFirstExistingPath([
  join(runtimeDir, 'inject.js'),
  join(runtimeDir, '..', 'inject.js'),
  join(runtimeDir, '..', '..', 'dist-electron', 'inject.js'),
]);

const QUICK_PROMPT_PASSTHROUGH_MODE = APP_CONFIG.layout.quickPrompt.passthroughMode;
const QUICK_PROMPT_MAX_WIDTH = APP_CONFIG.layout.quickPrompt.maxWidth;
const QUICK_PROMPT_MIN_WIDTH = APP_CONFIG.layout.quickPrompt.minWidth;
const QUICK_PROMPT_MIN_HEIGHT = APP_CONFIG.layout.quickPrompt.minHeight;
const QUICK_PROMPT_MAX_HEIGHT = APP_CONFIG.layout.quickPrompt.maxHeight;
const QUICK_PROMPT_VIEWPORT_PADDING = APP_CONFIG.layout.quickPrompt.viewportPadding;
const QUICK_PROMPT_LAYOUT_CONFIG = {
  passthroughMode: QUICK_PROMPT_PASSTHROUGH_MODE,
  minWidth: QUICK_PROMPT_MIN_WIDTH,
  maxWidth: QUICK_PROMPT_MAX_WIDTH,
  minHeight: QUICK_PROMPT_MIN_HEIGHT,
  maxHeight: QUICK_PROMPT_MAX_HEIGHT,
  viewportPadding: QUICK_PROMPT_VIEWPORT_PADDING,
} as const;
const SIDEBAR_TOGGLE_SHORTCUT_EVENT = APP_CONFIG.interaction.shortcuts.sidebarToggleEvent;
const PROVIDER_LOADING_EVENT = APP_CONFIG.interaction.shortcuts.providerLoadingEvent;
const PANE_LOAD_MAX_RETRIES = 2;
const PANE_LOAD_RETRY_BASE_DELAY_MS = 450;

interface ViewManagerOptions {
  config: AppConfig;
  runtimePreferences: RuntimePreferences;
}

export class ViewManager {
  private window: BaseWindow;
  private sidebarView: WebContentsView | null = null;
  private quickPromptView: WebContentsView | null = null;
  private paneViews: PaneViewState[] = [];
  private currentPaneCount: PaneCount = 1;
  private currentSidebarWidth: number;
  private quickPromptVisible = false;
  private quickPromptReady = false;
  private quickPromptDefaultHeight: number;
  private quickPromptHeight: number;
  private providers: Map<string, ProviderMeta>;
  private injectRuntimeScript: string | null = null;
  private paneZoomFactor: number;
  private sidebarZoomFactor: number;
  private defaultProviders: string[];
  private quickPromptAnchorPaneIndex = 0;
  private lastLayout: LayoutResult | null = null;
  private paneLoadMonitor: PaneLoadMonitor;
  private layoutService: LayoutService;
  private sidebarEventBridge: SidebarEventBridge;
  private promptDispatchService: PromptDispatchService;

  constructor(window: BaseWindow, options: ViewManagerOptions) {
    this.window = window;
    this.currentSidebarWidth = options.config.sidebar.expanded_width;
    this.providers = new Map(options.config.provider.catalog.map(p => [p.key, p]));
    this.paneZoomFactor = options.runtimePreferences.paneZoomFactor;
    this.sidebarZoomFactor = options.runtimePreferences.sidebarZoomFactor;
    this.quickPromptDefaultHeight = options.config.quick_prompt.default_height;
    this.quickPromptHeight = this.quickPromptDefaultHeight;
    this.defaultProviders = padProviderSequence(
      options.config.provider.panes,
      options.config.provider.pane_count
    );
    this.layoutService = new LayoutService(QUICK_PROMPT_LAYOUT_CONFIG);
    this.sidebarEventBridge = new SidebarEventBridge({
      getSidebarTarget: () => this.sidebarView?.webContents ?? null,
      providerLoadingEventName: PROVIDER_LOADING_EVENT,
    });
    this.promptDispatchService = new PromptDispatchService({
      getPaneTargets: () => this.paneViews.map((pane) => ({
        paneIndex: pane.paneIndex,
        executeJavaScript: (script: string, userGesture?: boolean) => {
          return pane.view.webContents.executeJavaScript(script, userGesture);
        },
      })),
      getInjectRuntimeScript: () => this.getInjectRuntimeScript(),
      onPaneExecutionError: (paneIndex, error) => {
        console.error(`[ViewManager] Failed to send prompt to pane ${paneIndex}:`, error);
      },
    });
    this.paneLoadMonitor = new PaneLoadMonitor({
      maxRetries: PANE_LOAD_MAX_RETRIES,
      retryBaseDelayMs: PANE_LOAD_RETRY_BASE_DELAY_MS,
      getTargetUrlForPane: (paneIndex, failedUrl) => {
        const pane = this.paneViews[paneIndex];
        return pane?.url ?? failedUrl;
      },
      getProviderKeyForPane: (paneIndex) => {
        const pane = this.paneViews[paneIndex];
        return pane?.providerKey ?? null;
      },
      getProviderNameForKey: (providerKey) => {
        return this.providers.get(providerKey)?.name ?? providerKey;
      },
    });
  }

  private getQuickPromptBounds(): { x: number; y: number; width: number; height: number } {
    return this.layoutService.computeQuickPromptBounds({
      contentBounds: this.window.getContentBounds(),
      sidebarWidth: this.currentSidebarWidth,
      lastLayout: this.lastLayout,
      anchorPaneIndex: this.quickPromptAnchorPaneIndex,
      requestedHeight: this.quickPromptHeight,
    });
  }

  private setQuickPromptAnchorPaneIndex(paneIndex: number): void {
    if (!Number.isInteger(paneIndex) || paneIndex < 0) {
      return;
    }
    this.quickPromptAnchorPaneIndex = paneIndex;
  }

  private findPaneIndexByWebContents(webContents: WebContents): number | null {
    for (const pane of this.paneViews) {
      if (pane.view.webContents.id === webContents.id) {
        return pane.paneIndex;
      }
    }
    return null;
  }

  private updateQuickPromptAnchorFromFocusedWebContents(): void {
    const focused = webContents.getFocusedWebContents();
    if (!focused) {
      return;
    }
    const paneIndex = this.findPaneIndexByWebContents(focused);
    if (paneIndex !== null) {
      this.setQuickPromptAnchorPaneIndex(paneIndex);
    }
  }

  private updateQuickPromptAnchorFromSource(sourceWebContents: WebContents): void {
    const paneIndex = this.findPaneIndexByWebContents(sourceWebContents);
    if (paneIndex !== null) {
      this.setQuickPromptAnchorPaneIndex(paneIndex);
      return;
    }
    this.updateQuickPromptAnchorFromFocusedWebContents();
  }

  private attachGlobalShortcutHooks(webContents: WebContents): void {
    webContents.on('before-input-event', (event: Event, input: Input) => {
      this.handleGlobalShortcut(event, input, webContents);
    });
  }

  private handleGlobalShortcut(event: Event, input: Input, sourceWebContents: WebContents): void {
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
    if (action === 'toggleQuickPrompt') {
      this.updateQuickPromptAnchorFromSource(sourceWebContents);
      this.toggleQuickPrompt();
      return;
    }
    if (action === 'notifySidebarToggle') {
      this.notifySidebarToggleShortcut();
      return;
    }
    if (action === 'resetAllPanes') {
      this.resetAllPanesToProviderHome();
    }
  }

  private applyPaneRuntimePreferences(webContents: WebContents): void {
    const rawUserAgent = webContents.getUserAgent();
    webContents.session.setUserAgent(rawUserAgent, PANE_ACCEPT_LANGUAGES);
    webContents.setZoomFactor(this.paneZoomFactor);
  }

  private applySidebarRuntimePreferences(webContents: WebContents): void {
    webContents.setZoomFactor(this.sidebarZoomFactor);
  }

  private attachPaneRuntimePreferenceHooks(webContents: WebContents): void {
    webContents.on('did-finish-load', () => {
      this.applyPaneRuntimePreferences(webContents);
    });
  }

  private attachSidebarRuntimePreferenceHooks(webContents: WebContents): void {
    webContents.on('did-finish-load', () => {
      this.applySidebarRuntimePreferences(webContents);
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

  private attachPaneContextMenuHooks(webContents: WebContents): void {
    webContents.on('context-menu', (_event: Event, params: ContextMenuParams) => {
      if (webContents.isDestroyed()) {
        return;
      }
      const menu = this.buildPaneContextMenu(webContents, params);
      menu.popup({
        window: this.window,
        frame: params.frame ?? undefined,
        x: Math.floor(params.x),
        y: Math.floor(params.y),
        sourceType: params.menuSourceType,
      });
    });
  }

  /**
   * Initialize sidebar WebContentsView
   */
  initSidebar(): WebContentsView {
    this.sidebarView = new WebContentsView({
      webPreferences: {
        preload: sidebarPreloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    this.window.contentView.addChildView(this.sidebarView);
    this.attachGlobalShortcutHooks(this.sidebarView.webContents);
    this.attachSidebarRuntimePreferenceHooks(this.sidebarView.webContents);
    this.applySidebarRuntimePreferences(this.sidebarView.webContents);

    // Load sidebar content
    if (process.env.NODE_ENV === 'development') {
      this.sidebarView.webContents.loadURL('http://localhost:5173');
    } else {
      this.sidebarView.webContents.loadFile(rendererIndexPath);
    }

    return this.sidebarView;
  }

  /**
   * Initialize global quick prompt overlay view
   */
  initQuickPrompt(): WebContentsView {
    if (this.quickPromptView) {
      return this.quickPromptView;
    }

    this.quickPromptView = new WebContentsView({
      webPreferences: {
        preload: quickPromptPreloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    this.quickPromptView.setBackgroundColor('#00000000');
    this.attachGlobalShortcutHooks(this.quickPromptView.webContents);
    this.quickPromptView.webContents.on('did-finish-load', () => {
      this.quickPromptReady = true;
      if (this.quickPromptVisible) {
        this.notifyQuickPromptOpened();
      }
    });
    this.quickPromptView.webContents.loadURL(buildQuickPromptDataUrl());

    return this.quickPromptView;
  }

  toggleQuickPrompt(): boolean {
    if (this.quickPromptVisible) {
      return this.hideQuickPrompt();
    }
    return this.showQuickPrompt();
  }

  showQuickPrompt(): boolean {
    if (!this.quickPromptView) {
      this.initQuickPrompt();
    }
    if (!this.quickPromptView || this.quickPromptVisible) {
      return this.quickPromptVisible;
    }

    this.updateQuickPromptAnchorFromFocusedWebContents();
    this.quickPromptHeight = this.quickPromptDefaultHeight;
    this.window.contentView.addChildView(this.quickPromptView);
    this.quickPromptView.setBounds(this.getQuickPromptBounds());
    this.quickPromptView.webContents.focus();
    this.quickPromptVisible = true;

    if (this.quickPromptReady) {
      this.notifyQuickPromptOpened();
    }

    return this.quickPromptVisible;
  }

  hideQuickPrompt(): boolean {
    if (!this.quickPromptView || !this.quickPromptVisible) {
      return false;
    }
    this.window.contentView.removeChildView(this.quickPromptView);
    this.quickPromptVisible = false;
    this.quickPromptHeight = this.quickPromptDefaultHeight;
    this.focusSidebarIfAvailable();
    return this.quickPromptVisible;
  }

  resizeQuickPrompt(nextHeight: number): { visible: boolean; height: number } {
    if (!Number.isFinite(nextHeight)) {
      return { visible: this.quickPromptVisible, height: this.quickPromptHeight };
    }

    const clampedHeight = Math.max(
      QUICK_PROMPT_MIN_HEIGHT,
      Math.min(QUICK_PROMPT_MAX_HEIGHT, Math.ceil(nextHeight))
    );
    this.quickPromptHeight = clampedHeight;

    if (this.quickPromptVisible && this.quickPromptView) {
      this.quickPromptView.setBounds(this.getQuickPromptBounds());
    }

    return { visible: this.quickPromptVisible, height: this.quickPromptHeight };
  }

  private focusSidebarIfAvailable(): void {
    if (!this.sidebarView) {
      return;
    }
    const sidebarContents = this.sidebarView.webContents;
    if (!sidebarContents.isDestroyed()) {
      sidebarContents.focus();
    }
  }

  private notifyQuickPromptOpened(): void {
    if (!this.quickPromptView) {
      return;
    }
    this.quickPromptView.webContents.executeJavaScript(
      `window.dispatchEvent(new Event('quick-prompt:open'));`,
      true
    ).catch((error) => {
      console.error('[ViewManager] Failed to focus quick prompt overlay:', error);
    });
  }

  private notifySidebarToggleShortcut(): void {
    this.sidebarEventBridge.dispatchEvent(SIDEBAR_TOGGLE_SHORTCUT_EVENT);
  }

  private clearProviderLoadingTracking(paneIndex: number): void {
    this.sidebarEventBridge.clearProviderLoadingTracking(paneIndex);
  }

  private beginProviderLoadingTracking(paneIndex: number, webContents: WebContents): void {
    this.sidebarEventBridge.beginProviderLoadingTracking(paneIndex, webContents);
  }

  private loadPaneUrl(
    paneIndex: number,
    view: WebContentsView,
    targetUrl: string,
    trackLoading: boolean
  ): void {
    this.paneLoadMonitor.markTarget(view.webContents.id, targetUrl);
    if (trackLoading) {
      this.beginProviderLoadingTracking(paneIndex, view.webContents);
    }
    view.webContents.loadURL(targetUrl).catch((error) => {
      console.error(`[ViewManager] Failed to load URL for pane ${paneIndex}: ${targetUrl}`, error);
    });
  }

  private createPaneWebContentsView(paneIndex: number): WebContentsView {
    const view = new WebContentsView({
      webPreferences: {
        preload: panePreloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        additionalArguments: [`--pane-index=${paneIndex}`],
      },
    });
    this.attachGlobalShortcutHooks(view.webContents);
    this.attachPaneContextMenuHooks(view.webContents);
    this.attachPaneRuntimePreferenceHooks(view.webContents);
    this.paneLoadMonitor.attachPane(paneIndex, view.webContents);
    view.webContents.on('focus', () => {
      this.setQuickPromptAnchorPaneIndex(paneIndex);
    });
    this.applyPaneRuntimePreferences(view.webContents);
    return view;
  }

  private removePaneViewFromContent(view: WebContentsView): void {
    try {
      this.window.contentView.removeChildView(view);
    } catch {
      // The view may be detached already when it is only kept in cache.
    }
  }

  private closePane(pane: PaneViewState): void {
    const uniqueViews = new Set<WebContentsView>();
    for (const cached of pane.cachedViews.values()) {
      uniqueViews.add(cached.view);
    }
    uniqueViews.add(pane.view);

    for (const view of uniqueViews) {
      this.removePaneViewFromContent(view);
      if (!view.webContents.isDestroyed()) {
        this.paneLoadMonitor.clear(view.webContents.id);
        view.webContents.close();
      }
    }
  }

  private keepQuickPromptOnTop(): void {
    if (!this.quickPromptVisible || !this.quickPromptView) {
      return;
    }
    this.window.contentView.removeChildView(this.quickPromptView);
    this.window.contentView.addChildView(this.quickPromptView);
  }

  /**
   * Set pane count, creating or destroying WebContentsViews as needed
   */
  setPaneCount(count: PaneCount): void {
    this.defaultProviders = padProviderSequence(this.defaultProviders, count);
    const result = setPaneCountWithLifecycle({
      count,
      paneViews: this.paneViews,
      defaultProviders: this.defaultProviders,
      providers: this.providers,
      quickPromptAnchorPaneIndex: this.quickPromptAnchorPaneIndex,
      callbacks: {
        createPaneWebContentsView: (paneIndex) => this.createPaneWebContentsView(paneIndex),
        addPaneViewToContent: (view) => this.window.contentView.addChildView(view),
        removePaneViewFromContent: (view) => this.removePaneViewFromContent(view),
        loadPaneUrl: (paneIndex, view, targetUrl, trackLoading) =>
          this.loadPaneUrl(paneIndex, view, targetUrl, trackLoading),
        applyPaneRuntimePreferences: (webContents) => this.applyPaneRuntimePreferences(webContents),
        clearProviderLoadingTracking: (paneIndex) => this.clearProviderLoadingTracking(paneIndex),
        closePane: (pane) => this.closePane(pane),
        keepQuickPromptOnTop: () => this.keepQuickPromptOnTop(),
        updateLayout: () => this.updateLayout(),
        setQuickPromptAnchorPaneIndex: (paneIndex) => this.setQuickPromptAnchorPaneIndex(paneIndex),
      },
    });
    this.currentPaneCount = result.currentPaneCount;
    this.quickPromptAnchorPaneIndex = result.quickPromptAnchorPaneIndex;
  }

  /**
   * Update provider for a specific pane
   */
  updatePaneProvider(paneIndex: number, providerKey: string): boolean {
    return updatePaneProviderWithLifecycle({
      paneIndex,
      providerKey,
      paneViews: this.paneViews,
      defaultProviders: this.defaultProviders,
      providers: this.providers,
      areUrlsEquivalent,
      callbacks: {
        createPaneWebContentsView: (nextPaneIndex) => this.createPaneWebContentsView(nextPaneIndex),
        addPaneViewToContent: (view) => this.window.contentView.addChildView(view),
        removePaneViewFromContent: (view) => this.removePaneViewFromContent(view),
        loadPaneUrl: (nextPaneIndex, view, targetUrl, trackLoading) =>
          this.loadPaneUrl(nextPaneIndex, view, targetUrl, trackLoading),
        applyPaneRuntimePreferences: (webContents) => this.applyPaneRuntimePreferences(webContents),
        clearProviderLoadingTracking: (nextPaneIndex) => this.clearProviderLoadingTracking(nextPaneIndex),
        closePane: (pane) => this.closePane(pane),
        keepQuickPromptOnTop: () => this.keepQuickPromptOnTop(),
        updateLayout: () => this.updateLayout(),
        setQuickPromptAnchorPaneIndex: (nextPaneIndex) => this.setQuickPromptAnchorPaneIndex(nextPaneIndex),
      },
    });
  }

  /**
   * Reload all panes to each pane's active provider home page.
   */
  resetAllPanesToProviderHome(): boolean {
    return resetAllPanesToProviderHomeWithLifecycle({
      paneViews: this.paneViews,
      defaultProviders: this.defaultProviders,
      providers: this.providers,
      callbacks: {
        createPaneWebContentsView: (paneIndex) => this.createPaneWebContentsView(paneIndex),
        addPaneViewToContent: (view) => this.window.contentView.addChildView(view),
        removePaneViewFromContent: (view) => this.removePaneViewFromContent(view),
        loadPaneUrl: (paneIndex, view, targetUrl, trackLoading) =>
          this.loadPaneUrl(paneIndex, view, targetUrl, trackLoading),
        applyPaneRuntimePreferences: (webContents) => this.applyPaneRuntimePreferences(webContents),
        clearProviderLoadingTracking: (paneIndex) => this.clearProviderLoadingTracking(paneIndex),
        closePane: (pane) => this.closePane(pane),
        keepQuickPromptOnTop: () => this.keepQuickPromptOnTop(),
        updateLayout: () => this.updateLayout(),
        setQuickPromptAnchorPaneIndex: (paneIndex) => this.setQuickPromptAnchorPaneIndex(paneIndex),
      },
    });
  }

  /**
   * Update sidebar width and recalculate layout
   */
  setSidebarWidth(width: number): void {
    this.currentSidebarWidth = width;
    this.updateLayout();
  }

  /**
   * Recalculate and apply all view bounds
   */
  updateLayout(sidebarWidth?: number): void {
    if (sidebarWidth !== undefined) {
      this.currentSidebarWidth = sidebarWidth;
    }

    const { layout } = this.layoutService.computeLayout({
      contentBounds: this.window.getContentBounds(),
      sidebarWidth: this.currentSidebarWidth,
      paneCount: this.currentPaneCount,
    });
    this.lastLayout = layout;

    // Apply sidebar bounds
    if (this.sidebarView) {
      this.sidebarView.setBounds(layout.sidebar);
    }

    // Apply pane bounds
    for (let i = 0; i < this.paneViews.length; i++) {
      if (layout.panes[i]) {
        this.paneViews[i].view.setBounds(layout.panes[i]);
      }
    }

    // Keep quick prompt pinned to its computed bounds.
    if (this.quickPromptVisible && this.quickPromptView) {
      this.quickPromptView.setBounds(this.getQuickPromptBounds());
    }
  }

  /**
   * Send prompt to all panes
   */
  async sendPromptToAll(text: string): Promise<{ success: boolean; failures: string[] }> {
    return this.promptDispatchService.sendPromptToAll(text);
  }

  /**
   * Sync prompt draft text to all panes without submitting
   */
  async syncPromptDraftToAll(text: string): Promise<{ success: boolean; failures: string[] }> {
    return this.promptDispatchService.syncPromptDraftToAll(text);
  }

  private getInjectRuntimeScript(): string | null {
    if (this.injectRuntimeScript) {
      return this.injectRuntimeScript;
    }

    if (!existsSync(injectRuntimePath)) {
      console.error(`[ViewManager] Inject runtime not found at ${injectRuntimePath}`);
      return null;
    }

    try {
      this.injectRuntimeScript = readFileSync(injectRuntimePath, 'utf8');
      return this.injectRuntimeScript;
    } catch (error) {
      console.error('[ViewManager] Failed to read inject runtime:', error);
      return null;
    }
  }

  /**
   * Get current pane count
   */
  getPaneCount(): PaneCount {
    return this.currentPaneCount;
  }

  /**
   * Get current sidebar width
   */
  getSidebarWidth(): number {
    return this.currentSidebarWidth;
  }

  /**
   * Clean up all views and resources
   * Call this before window closes
   */
  destroy(): void {
    // Close all pane webContents
    for (const pane of this.paneViews) {
      try {
        this.clearProviderLoadingTracking(pane.paneIndex);
        this.closePane(pane);
      } catch (e) {
        console.error(`[ViewManager] Error closing pane ${pane.paneIndex}:`, e);
      }
    }
    this.paneViews = [];
    this.paneLoadMonitor.clearAll();
    this.lastLayout = null;

    // Close quick prompt webContents
    if (this.quickPromptView) {
      try {
        if (this.quickPromptVisible) {
          this.window.contentView.removeChildView(this.quickPromptView);
        }
        this.quickPromptView.webContents.close();
      } catch (e) {
        console.error('[ViewManager] Error closing quick prompt:', e);
      }
      this.quickPromptView = null;
      this.quickPromptVisible = false;
      this.quickPromptReady = false;
    }

    // Close sidebar webContents
    if (this.sidebarView) {
      try {
        this.window.contentView.removeChildView(this.sidebarView);
        this.sidebarView.webContents.close();
      } catch (e) {
        console.error('[ViewManager] Error closing sidebar:', e);
      }
      this.sidebarView = null;
    }
  }
}
