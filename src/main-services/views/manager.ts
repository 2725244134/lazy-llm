/**
 * ViewManager - manages sidebar and pane WebContentsViews
 */

import {
  BaseWindow,
  type Event,
  type Input,
  ipcMain,
  type IpcMainEvent,
  type WebContents,
  WebContentsView,
} from 'electron';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { APP_CONFIG } from '@shared-config/src/app.js';
import { type LayoutResult } from './geometry.js';
import { loadInjectRuntimeScript } from './injectRuntimeLoader.js';
import { LayoutService } from './layoutService.js';
import { PaneLoadMonitor, areUrlsEquivalent } from './paneLoadMonitor.js';
import { PaneViewService, type PaneUserAgentStrategy } from './paneViewService.js';
import {
  type PaneViewState,
  resetAllPanesToProviderHomeWithLifecycle,
  setPaneCountWithLifecycle,
  updatePaneProviderWithLifecycle,
} from './paneLifecycleService.js';
import {
  computeSidebarWidthTweenFrame,
  normalizeSidebarWidth,
  SidebarController,
} from './sidebar/index.js';
import { PromptDispatchService } from './promptDispatchService.js';
import {
  QuickPromptController,
  buildQuickPromptDataUrl,
} from './quick-prompt/index.js';
import { resolveShortcutAction, type ShortcutAction } from './shortcutDispatcher.js';
import { PANE_ACCEPT_LANGUAGES } from './paneRuntimePreferences.js';
import type { RuntimePreferences } from '../ipc-handlers/store.js';
import { padProviderSequence } from '../ipc-handlers/providerConfig.js';
import type {
  AppConfig,
  PaneCount,
  PaneStagePromptImageAckPayload,
  PaneStagePromptImagePayload,
  PromptImagePayload,
  PromptRequest,
  ProviderMeta,
} from '@shared-contracts/ipc/contracts';
import { IPC_CHANNELS } from '@shared-contracts/ipc/contracts';

const runtimeDir = fileURLToPath(new URL('.', import.meta.url));

function resolveFirstExistingPath(candidates: string[]): string {
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
}

const PRELOAD_EXTS = ['.cjs', '.js', '.mjs'] as const;
const PRELOAD_SEARCH_DIRS = [
  runtimeDir,
  join(runtimeDir, '..'),
  join(runtimeDir, '..', '..'),
  join(process.cwd(), 'dist-electron'),
];

function resolvePreloadPath(baseName: string): string {
  return resolveFirstExistingPath(
    PRELOAD_SEARCH_DIRS.flatMap(dir => PRELOAD_EXTS.map(ext => join(dir, baseName + ext)))
  );
}

const sidebarPreloadPath = resolvePreloadPath('preload');
const panePreloadPath = resolvePreloadPath('pane-preload');
const quickPromptPreloadPath = resolvePreloadPath('quick-prompt-preload');

const rendererIndexPath = resolveFirstExistingPath([
  join(runtimeDir, '..', 'renderer', 'main_window', 'index.html'),
  join(process.cwd(), '.vite', 'renderer', 'main_window', 'index.html'),
  join(runtimeDir, '..', '..', '..', 'renderer', 'main_window', 'index.html'),
  join(runtimeDir, '..', 'dist', 'index.html'),
  join(runtimeDir, '..', '..', 'dist', 'index.html'),
  join(process.cwd(), 'dist', 'index.html'),
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
const SIDEBAR_TRANSITION_DURATION_MS = APP_CONFIG.layout.sidebar.transitionDurationMs;
const SIDEBAR_ANIMATION_TICK_MS = 16;
const PANE_LOAD_MAX_RETRIES = 2;
const PANE_LOAD_RETRY_BASE_DELAY_MS = 450;
const PANE_STAGE_PROMPT_IMAGE_TIMEOUT_MS = 2_000;
type ManagedShortcutAction = Exclude<ShortcutAction, 'noop'>;

interface ViewManagerOptions {
  config: AppConfig;
  runtimePreferences: RuntimePreferences;
  rendererDevServerUrl?: string | null;
  paneSessionPartition: string;
  paneUserAgentStrategy: PaneUserAgentStrategy;
}

export class ViewManager {
  private window: BaseWindow;
  private paneViews: PaneViewState[] = [];
  private currentPaneCount: PaneCount = 1;
  private currentSidebarWidth: number;
  private providers: Map<string, ProviderMeta>;
  private injectRuntimeScript: string | null = null;
  private paneZoomFactor: number;
  private sidebarZoomFactor: number;
  private defaultProviders: string[];
  private lastLayout: LayoutResult | null = null;
  private paneViewService: PaneViewService;
  private layoutService: LayoutService;
  private sidebarController: SidebarController;
  private quickPromptController: QuickPromptController;
  private promptDispatchService: PromptDispatchService;
  private sidebarWidthAnimationTimer: ReturnType<typeof setTimeout> | null = null;
  private sidebarWidthAnimationToken = 0;
  private sidebarWidthAnimationTarget: number | null = null;
  private rendererDevServerUrl: string | null;
  private promptImageStageRequestSeq = 0;
  private readonly pendingPromptImageStageRequests = new Map<string, {
    paneIndex: number;
    consumeToken: string;
    timer: ReturnType<typeof setTimeout>;
    resolve: (consumeToken: string) => void;
    reject: (error: Error) => void;
  }>();

  constructor(window: BaseWindow, options: ViewManagerOptions) {
    this.window = window;
    this.rendererDevServerUrl = normalizeRendererDevServerUrl(options.rendererDevServerUrl);
    this.currentSidebarWidth = options.config.sidebar.expanded_width;
    this.providers = new Map(options.config.provider.catalog.map(p => [p.key, p]));
    this.paneZoomFactor = options.runtimePreferences.paneZoomFactor;
    this.sidebarZoomFactor = options.runtimePreferences.sidebarZoomFactor;
    this.defaultProviders = padProviderSequence(
      options.config.provider.panes,
      options.config.provider.pane_count
    );
    this.layoutService = new LayoutService(QUICK_PROMPT_LAYOUT_CONFIG);
    this.sidebarController = new SidebarController({
      hostWindow: this.window,
      sidebarPreloadPath,
      rendererDevServerUrl: this.rendererDevServerUrl,
      rendererIndexPath,
      providerLoadingEventName: PROVIDER_LOADING_EVENT,
      sidebarZoomFactor: this.sidebarZoomFactor,
      attachGlobalShortcutHooks: (webContents) => this.attachGlobalShortcutHooks(webContents),
    });
    this.quickPromptController = new QuickPromptController({
      hostWindow: this.window,
      quickPromptPreloadPath,
      defaultHeight: options.config.quick_prompt.default_height,
      minHeight: QUICK_PROMPT_MIN_HEIGHT,
      maxHeight: QUICK_PROMPT_MAX_HEIGHT,
      resolveBounds: (requestedHeight, anchorPaneIndex) =>
        this.getQuickPromptBounds(requestedHeight, anchorPaneIndex),
      resolvePaneIndexByWebContents: (webContents) =>
        this.findPaneIndexByWebContents(webContents),
      focusSidebarIfAvailable: () => this.sidebarController.focusIfAvailable(),
      attachGlobalShortcutHooks: (webContents) => this.attachGlobalShortcutHooks(webContents),
      buildQuickPromptDataUrl: () => buildQuickPromptDataUrl(),
    });
    this.promptDispatchService = new PromptDispatchService({
      getPaneTargets: () => this.paneViews.map((pane) => ({
        paneIndex: pane.paneIndex,
        executeJavaScript: (script: string, userGesture?: boolean) => {
          return pane.view.webContents.executeJavaScript(script, userGesture);
        },
        stagePromptImagePayload: (image) => {
          return this.stagePromptImagePayload(
            pane.view.webContents,
            pane.paneIndex,
            image
          );
        },
      })),
      getInjectRuntimeScript: () => this.getInjectRuntimeScript(),
      onPaneExecutionError: (paneIndex, error) => {
        console.error(`[ViewManager] Failed to send prompt to pane ${paneIndex}:`, error);
      },
    });
    ipcMain.on(IPC_CHANNELS.PANE_STAGE_PROMPT_IMAGE_ACK, this.handlePaneStagePromptImageAck);
    const paneLoadMonitor = new PaneLoadMonitor({
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
      onPaneLoadFailure: (failure) => {
        if (failure.action !== 'show-error') {
          return;
        }
        console.error('[PaneLoadMonitor] Pane load failed after retry budget', failure);
      },
    });
    this.paneViewService = new PaneViewService({
      hostWindow: this.window,
      panePreloadPath,
      paneSessionPartition: options.paneSessionPartition,
      paneUserAgentStrategy: options.paneUserAgentStrategy,
      paneAcceptLanguages: PANE_ACCEPT_LANGUAGES,
      paneZoomFactor: this.paneZoomFactor,
      paneLoadMonitor,
      onPaneShortcutAction: (action, sourceWebContents) =>
        this.handleShortcutAction(action, sourceWebContents),
      setQuickPromptAnchorPaneIndex: (paneIndex) => this.quickPromptController.setAnchorPaneIndex(paneIndex),
      beginProviderLoadingTracking: (paneIndex, webContents) =>
        this.beginProviderLoadingTracking(paneIndex, webContents),
      removePaneViewFromContent: (view) => this.window.contentView.removeChildView(view),
      onPaneLoadUrlError: (paneIndex, targetUrl, error) => {
        console.error(`[ViewManager] Failed to load URL for pane ${paneIndex}: ${targetUrl}`, error);
      },
    });
  }

  private getQuickPromptBounds(
    requestedHeight: number,
    anchorPaneIndex: number,
  ): { x: number; y: number; width: number; height: number } {
    return this.layoutService.computeQuickPromptBounds({
      contentBounds: this.window.getContentBounds(),
      sidebarWidth: this.currentSidebarWidth,
      lastLayout: this.lastLayout,
      anchorPaneIndex,
      requestedHeight,
    });
  }

  private findPaneIndexByWebContents(webContents: WebContents): number | null {
    for (const pane of this.paneViews) {
      if (pane.view.webContents.id === webContents.id) {
        return pane.paneIndex;
      }
    }
    return null;
  }


  private attachGlobalShortcutHooks(webContents: WebContents): void {
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
      this.handleShortcutAction(action, webContents);
    });
  }

  private handleShortcutAction(action: ManagedShortcutAction, sourceWebContents: WebContents): void {
    if (action === 'toggleQuickPrompt') {
      this.quickPromptController.toggleQuickPrompt(sourceWebContents);
      return;
    }
    if (action === 'notifySidebarToggle') {
      this.sidebarController.dispatchShortcutEvent(SIDEBAR_TOGGLE_SHORTCUT_EVENT);
      return;
    }
    if (action === 'resetAllPanes') {
      this.resetAllPanesToProviderHome();
    }
  }

  /**
   * Initialize sidebar WebContentsView
   */
  initSidebar(): WebContentsView {
    return this.sidebarController.initSidebar();
  }

  /**
   * Initialize global quick prompt overlay view
   */
  initQuickPrompt(): WebContentsView {
    return this.quickPromptController.initQuickPrompt();
  }

  toggleQuickPrompt(sourceWebContents?: WebContents): boolean {
    return this.quickPromptController.toggleQuickPrompt(sourceWebContents);
  }

  showQuickPrompt(): boolean {
    return this.quickPromptController.showQuickPrompt();
  }

  hideQuickPrompt(): boolean {
    return this.quickPromptController.hideQuickPrompt();
  }

  resizeQuickPrompt(nextHeight: number): { visible: boolean; height: number } {
    return this.quickPromptController.resizeQuickPrompt(nextHeight);
  }

  private readonly handlePaneStagePromptImageAck = (
    _event: IpcMainEvent,
    payload: PaneStagePromptImageAckPayload
  ): void => {
    const requestId = typeof payload?.requestId === 'string' ? payload.requestId : '';
    if (!requestId) {
      return;
    }

    const pending = this.pendingPromptImageStageRequests.get(requestId);
    if (!pending) {
      return;
    }

    this.pendingPromptImageStageRequests.delete(requestId);
    clearTimeout(pending.timer);

    const responsePaneIndex = typeof payload?.paneIndex === 'number'
      ? payload.paneIndex
      : pending.paneIndex;
    if (responsePaneIndex !== pending.paneIndex) {
      pending.reject(new Error(
        `prompt image stage ack pane mismatch: expected ${pending.paneIndex}, got ${responsePaneIndex}`
      ));
      return;
    }

    if (payload.success === true) {
      pending.resolve(pending.consumeToken);
      return;
    }

    pending.reject(new Error(
      typeof payload.reason === 'string' && payload.reason
        ? payload.reason
        : 'failed to stage prompt image payload'
    ));
  };

  private stagePromptImagePayload(
    paneWebContents: WebContents,
    paneIndex: number,
    image: PromptImagePayload
  ): Promise<string> {
    if (paneWebContents.isDestroyed()) {
      return Promise.reject(new Error('pane webContents is destroyed'));
    }

    const requestId = `${paneIndex}:${Date.now()}:${this.promptImageStageRequestSeq++}`;
    const consumeToken = randomUUID();
    const stagePayload: PaneStagePromptImagePayload = {
      requestId,
      consumeToken,
      image,
    };

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingPromptImageStageRequests.delete(requestId);
        reject(new Error('timed out while staging prompt image payload'));
      }, PANE_STAGE_PROMPT_IMAGE_TIMEOUT_MS);

      const rejectWithError = (error: unknown): void => {
        clearTimeout(timer);
        this.pendingPromptImageStageRequests.delete(requestId);
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      this.pendingPromptImageStageRequests.set(requestId, {
        paneIndex,
        consumeToken,
        timer,
        resolve,
        reject: (error) => {
          rejectWithError(error);
        },
      });

      try {
        paneWebContents.send(IPC_CHANNELS.PANE_STAGE_PROMPT_IMAGE, stagePayload);
      } catch (error) {
        rejectWithError(error);
      }
    });
  }

  private rejectPendingPromptImageStageRequests(reason: string): void {
    for (const [requestId, pending] of this.pendingPromptImageStageRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
      this.pendingPromptImageStageRequests.delete(requestId);
    }
  }

  private clearProviderLoadingTracking(paneIndex: number): void {
    this.sidebarController.clearProviderLoadingTracking(paneIndex);
  }

  private beginProviderLoadingTracking(paneIndex: number, webContents: WebContents): void {
    this.sidebarController.beginProviderLoadingTracking(paneIndex, webContents);
  }

  private keepQuickPromptOnTop(): void {
    this.quickPromptController.keepOnTop();
  }

  private buildLifecycleCallbacks() {
    return {
      createPaneWebContentsView: (paneIndex: number) => this.paneViewService.createPaneWebContentsView(paneIndex),
      addPaneViewToContent: (view: WebContentsView) => this.window.contentView.addChildView(view),
      removePaneViewFromContent: (view: WebContentsView) => this.paneViewService.removePaneViewFromContent(view),
      loadPaneUrl: (paneIndex: number, view: WebContentsView, targetUrl: string, trackLoading: boolean) =>
        this.paneViewService.loadPaneUrl(paneIndex, view, targetUrl, trackLoading),
      applyPaneRuntimePreferences: (wc: WebContents) => this.paneViewService.applyPaneRuntimePreferences(wc),
      clearProviderLoadingTracking: (paneIndex: number) => this.clearProviderLoadingTracking(paneIndex),
      closePane: (pane: PaneViewState) => this.paneViewService.closePane(pane),
      keepQuickPromptOnTop: () => this.keepQuickPromptOnTop(),
      updateLayout: () => this.updateLayout(),
      setQuickPromptAnchorPaneIndex: (paneIndex: number) =>
        this.quickPromptController.setAnchorPaneIndex(paneIndex),
    };
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
      quickPromptAnchorPaneIndex: this.quickPromptController.getAnchorPaneIndex(),
      callbacks: this.buildLifecycleCallbacks(),
    });
    this.currentPaneCount = result.currentPaneCount;
    this.quickPromptController.setAnchorPaneIndex(result.quickPromptAnchorPaneIndex);
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
      callbacks: this.buildLifecycleCallbacks(),
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
      callbacks: this.buildLifecycleCallbacks(),
    });
  }

  /**
   * Update sidebar width and recalculate layout
   */
  setSidebarWidth(width: number): void {
    this.updateLayout(width);
  }

  private stopSidebarWidthAnimation(): void {
    this.sidebarWidthAnimationToken += 1;
    this.sidebarWidthAnimationTarget = null;
    if (this.sidebarWidthAnimationTimer !== null) {
      clearTimeout(this.sidebarWidthAnimationTimer);
      this.sidebarWidthAnimationTimer = null;
    }
  }

  private animateSidebarWidthTo(targetSidebarWidth: number): void {
    const fromSidebarWidth = this.currentSidebarWidth;
    if (
      targetSidebarWidth === fromSidebarWidth ||
      SIDEBAR_TRANSITION_DURATION_MS <= 0
    ) {
      this.stopSidebarWidthAnimation();
      this.currentSidebarWidth = targetSidebarWidth;
      this.applyLayout();
      return;
    }

    this.stopSidebarWidthAnimation();
    this.sidebarWidthAnimationTarget = targetSidebarWidth;
    const animationToken = ++this.sidebarWidthAnimationToken;
    const startedAtMs = Date.now();

    const tick = (): void => {
      if (animationToken !== this.sidebarWidthAnimationToken) {
        return;
      }

      const frame = computeSidebarWidthTweenFrame({
        fromWidth: fromSidebarWidth,
        targetWidth: targetSidebarWidth,
        elapsedMs: Date.now() - startedAtMs,
        durationMs: SIDEBAR_TRANSITION_DURATION_MS,
      });

      if (frame.width !== this.currentSidebarWidth) {
        this.currentSidebarWidth = frame.width;
        this.applyLayout();
      }

      if (frame.isComplete) {
        this.sidebarWidthAnimationTimer = null;
        this.sidebarWidthAnimationTarget = null;
        if (this.currentSidebarWidth !== targetSidebarWidth) {
          this.currentSidebarWidth = targetSidebarWidth;
          this.applyLayout();
        }
        return;
      }

      this.sidebarWidthAnimationTimer = setTimeout(tick, SIDEBAR_ANIMATION_TICK_MS);
    };

    tick();
  }

  private applyLayout(): void {
    const normalizedSidebarWidth = Math.max(1, Math.floor(this.currentSidebarWidth));
    this.currentSidebarWidth = normalizedSidebarWidth;

    const { layout } = this.layoutService.computeLayout({
      contentBounds: this.window.getContentBounds(),
      sidebarWidth: normalizedSidebarWidth,
      paneCount: this.currentPaneCount,
    });
    this.lastLayout = layout;

    // Apply sidebar bounds
    this.sidebarController.setBounds(layout.sidebar);

    // Apply pane bounds
    for (let i = 0; i < this.paneViews.length; i++) {
      if (layout.panes[i]) {
        this.paneViews[i].view.setBounds(layout.panes[i]);
      }
    }

    // Keep quick prompt pinned to its computed bounds.
    this.quickPromptController.relayout();
  }

  /**
   * Recalculate and apply all view bounds
   */
  updateLayout(sidebarWidth?: number): void {
    if (sidebarWidth === undefined) {
      this.applyLayout();
      return;
    }

    const normalizedSidebarWidth = normalizeSidebarWidth(sidebarWidth);
    if (
      this.sidebarWidthAnimationTimer !== null &&
      this.sidebarWidthAnimationTarget === normalizedSidebarWidth
    ) {
      return;
    }
    if (normalizedSidebarWidth === this.currentSidebarWidth) {
      this.stopSidebarWidthAnimation();
      this.applyLayout();
      return;
    }

    this.animateSidebarWidthTo(normalizedSidebarWidth);
  }

  /**
   * Send prompt to all panes
   */
  async sendPromptToAll(
    request: string | PromptRequest
  ): Promise<{ success: boolean; failures: string[] }> {
    return this.promptDispatchService.sendPromptToAll(request);
  }

  /**
   * Attach prompt image to all panes without submitting
   */
  async attachPromptImageToAll(
    image: PromptImagePayload
  ): Promise<{ success: boolean; failures: string[] }> {
    return this.promptDispatchService.attachPromptImageToAll(image);
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

    const script = loadInjectRuntimeScript({
      runtimeDir,
      cwd: process.cwd(),
      resourcesPath: process.resourcesPath,
      mockProvidersFile: process.env.LAZYLLM_MOCK_PROVIDERS_FILE,
      logger: console,
    });
    if (!script) {
      return null;
    }

    this.injectRuntimeScript = script;
    return this.injectRuntimeScript;
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
    this.stopSidebarWidthAnimation();
    ipcMain.off(IPC_CHANNELS.PANE_STAGE_PROMPT_IMAGE_ACK, this.handlePaneStagePromptImageAck);
    this.rejectPendingPromptImageStageRequests(
      'view manager destroyed before prompt image staging completed'
    );

    // Close all pane webContents
    for (const pane of this.paneViews) {
      try {
        this.clearProviderLoadingTracking(pane.paneIndex);
        this.paneViewService.closePane(pane);
      } catch (e) {
        console.error(`[ViewManager] Error closing pane ${pane.paneIndex}:`, e);
      }
    }
    this.paneViews = [];
    this.paneViewService.clearAllPaneLoadState();
    this.lastLayout = null;

    // Close quick prompt webContents
    this.quickPromptController.destroy();

    // Close sidebar webContents
    this.sidebarController.destroy();
  }
}

function normalizeRendererDevServerUrl(url?: string | null): string | null {
  if (typeof url !== 'string') {
    return null;
  }
  const normalized = url.trim();
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return normalized;
  }
  return null;
}
