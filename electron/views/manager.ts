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
import { calculateLayout, type LayoutResult } from './geometry.js';
import { calculateQuickPromptBounds } from './quickPromptGeometry.js';
import { decidePaneLoadRecovery, type PaneRecoveryState } from './paneRecovery.js';
import {
  buildPromptDraftSyncEvalScript,
  buildPromptInjectionEvalScript,
  type PromptInjectionResult,
} from './promptInjection.js';
import { buildQuickPromptDataUrl } from './quick-prompt/index.js';
import {
  PANE_ACCEPT_LANGUAGES,
} from './paneRuntimePreferences.js';
import type { RuntimePreferences } from '../ipc-handlers/externalConfig.js';
import { padProviderSequence } from '../ipc-handlers/providerConfig.js';
import type {
  AppConfig,
  PaneCount,
  ProviderMeta,
  ViewRect,
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
const SIDEBAR_TOGGLE_SHORTCUT_EVENT = APP_CONFIG.interaction.shortcuts.sidebarToggleEvent;
const PROVIDER_LOADING_EVENT = APP_CONFIG.interaction.shortcuts.providerLoadingEvent;
const PANE_LOAD_MAX_RETRIES = 2;
const PANE_LOAD_RETRY_BASE_DELAY_MS = 450;

interface PaneView {
  view: WebContentsView;
  paneIndex: number;
  providerKey: string;
  url: string;
  cachedViews: Map<string, { view: WebContentsView; url: string }>;
}

interface ViewManagerOptions {
  config: AppConfig;
  runtimePreferences: RuntimePreferences;
}

function toFailureReason(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class ViewManager {
  private window: BaseWindow;
  private sidebarView: WebContentsView | null = null;
  private quickPromptView: WebContentsView | null = null;
  private paneViews: PaneView[] = [];
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
  private providerSwitchLoadTokens = new Map<number, string>();
  private quickPromptAnchorPaneIndex = 0;
  private lastLayout: LayoutResult | null = null;
  private paneLoadRecoveryByWebContents = new Map<number, PaneRecoveryState>();

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
  }

  /**
   * Get drawable content size (exclude native window frame/title/menu areas)
   */
  private getContentSize(): { width: number; height: number } {
    const contentBounds = this.window.getContentBounds();
    return {
      width: Math.max(1, contentBounds.width),
      height: Math.max(1, contentBounds.height),
    };
  }

  private getPaneAreaFallbackBounds(contentSize: { width: number; height: number }): ViewRect {
    const paneAreaX = Math.max(0, Math.min(this.currentSidebarWidth, contentSize.width - 1));
    return {
      x: paneAreaX,
      y: 0,
      width: Math.max(1, contentSize.width - paneAreaX),
      height: contentSize.height,
    };
  }

  private getQuickPromptAnchorBounds(contentSize: { width: number; height: number }): ViewRect {
    if (!this.lastLayout || this.lastLayout.panes.length === 0) {
      return this.getPaneAreaFallbackBounds(contentSize);
    }

    const paneIndex = Math.max(
      0,
      Math.min(this.quickPromptAnchorPaneIndex, this.lastLayout.panes.length - 1)
    );
    return this.lastLayout.panes[paneIndex] ?? this.lastLayout.panes[0];
  }

  private getQuickPromptBounds(): { x: number; y: number; width: number; height: number } {
    const contentSize = this.getContentSize();
    const anchor = this.getQuickPromptAnchorBounds(contentSize);

    return calculateQuickPromptBounds({
      viewport: contentSize,
      anchor,
      requestedHeight: this.quickPromptHeight,
      passthroughMode: QUICK_PROMPT_PASSTHROUGH_MODE,
      minWidth: QUICK_PROMPT_MIN_WIDTH,
      maxWidth: QUICK_PROMPT_MAX_WIDTH,
      minHeight: QUICK_PROMPT_MIN_HEIGHT,
      maxHeight: QUICK_PROMPT_MAX_HEIGHT,
      viewportPadding: QUICK_PROMPT_VIEWPORT_PADDING,
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
    const isKeyDownLike = input.type === 'keyDown' || input.type === 'rawKeyDown';
    if (!isKeyDownLike || input.isAutoRepeat) {
      return;
    }

    const key = typeof input.key === 'string' ? input.key.toLowerCase() : '';
    const isShortcutModifier = Boolean(input.control || input.meta);
    const isBaseShortcut = isShortcutModifier && !input.alt && !input.shift;

    if (isBaseShortcut && key === 'j') {
      event.preventDefault();
      this.updateQuickPromptAnchorFromSource(sourceWebContents);
      this.toggleQuickPrompt();
      return;
    }

    if (isBaseShortcut && key === 'b') {
      event.preventDefault();
      this.notifySidebarToggleShortcut();
      return;
    }

    if (isBaseShortcut && key === 'r') {
      event.preventDefault();
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
    if (!this.sidebarView) {
      return;
    }
    this.sidebarView.webContents.executeJavaScript(
      `window.dispatchEvent(new Event('${SIDEBAR_TOGGLE_SHORTCUT_EVENT}'));`,
      true
    ).catch((error) => {
      console.error('[ViewManager] Failed to dispatch sidebar toggle shortcut event:', error);
    });
  }

  private dispatchSidebarCustomEvent(eventName: string, detail: unknown): void {
    if (!this.sidebarView) {
      return;
    }

    const serializedEventName = JSON.stringify(eventName);
    const serializedDetail = JSON.stringify(detail);
    this.sidebarView.webContents.executeJavaScript(
      `window.dispatchEvent(new CustomEvent(${serializedEventName}, { detail: ${serializedDetail} }));`,
      true
    ).catch((error) => {
      console.error(`[ViewManager] Failed to dispatch sidebar event ${eventName}:`, error);
    });
  }

  private notifyProviderLoadingState(paneIndex: number, loading: boolean): void {
    this.dispatchSidebarCustomEvent(PROVIDER_LOADING_EVENT, {
      paneIndex,
      loading,
    });
  }

  private clearProviderLoadingTracking(paneIndex: number): void {
    if (!this.providerSwitchLoadTokens.has(paneIndex)) {
      return;
    }

    this.providerSwitchLoadTokens.delete(paneIndex);
    this.notifyProviderLoadingState(paneIndex, false);
  }

  private beginProviderLoadingTracking(paneIndex: number, webContents: WebContents): void {
    const token = `${paneIndex}:${Date.now()}:${Math.random()}`;
    this.providerSwitchLoadTokens.set(paneIndex, token);
    this.notifyProviderLoadingState(paneIndex, true);

    const complete = () => {
      if (webContents.isLoadingMainFrame()) {
        return;
      }
      cleanup();
      if (this.providerSwitchLoadTokens.get(paneIndex) !== token) {
        return;
      }
      this.providerSwitchLoadTokens.delete(paneIndex);
      this.notifyProviderLoadingState(paneIndex, false);
    };

    const fail = () => {
      cleanup();
      if (this.providerSwitchLoadTokens.get(paneIndex) !== token) {
        return;
      }
      this.providerSwitchLoadTokens.delete(paneIndex);
      this.notifyProviderLoadingState(paneIndex, false);
    };

    const cleanup = () => {
      webContents.removeListener('did-stop-loading', complete);
      webContents.removeListener('did-fail-load', fail);
    };

    webContents.on('did-stop-loading', complete);
    webContents.on('did-fail-load', fail);
  }

  private areUrlsEquivalent(left: string, right: string): boolean {
    if (left === right) {
      return true;
    }
    if (!left || !right) {
      return false;
    }

    try {
      const leftUrl = new URL(left);
      const rightUrl = new URL(right);
      return (
        leftUrl.origin === rightUrl.origin
        && leftUrl.pathname === rightUrl.pathname
        && leftUrl.search === rightUrl.search
      );
    } catch {
      return false;
    }
  }

  private setPaneLoadTarget(webContents: WebContents, targetUrl: string): void {
    this.paneLoadRecoveryByWebContents.set(webContents.id, {
      targetUrl,
      attemptCount: 0,
    });
  }

  private loadPaneUrl(
    paneIndex: number,
    view: WebContentsView,
    targetUrl: string,
    trackLoading: boolean
  ): void {
    this.setPaneLoadTarget(view.webContents, targetUrl);
    if (trackLoading) {
      this.beginProviderLoadingTracking(paneIndex, view.webContents);
    }
    view.webContents.loadURL(targetUrl).catch((error) => {
      console.error(`[ViewManager] Failed to load URL for pane ${paneIndex}: ${targetUrl}`, error);
    });
  }

  private buildPaneLoadErrorDataUrl(options: {
    providerName: string;
    targetUrl: string;
    errorCode: number;
    errorDescription: string;
    attemptCount: number;
  }): string {
    const title = escapeHtml(`${options.providerName} failed to load`);
    const description = escapeHtml(options.errorDescription || 'Unknown error');
    const safeTargetUrl = escapeHtml(options.targetUrl);
    const serializedTargetUrl = JSON.stringify(options.targetUrl);
    const attemptText = escapeHtml(String(options.attemptCount));
    const errorCodeText = escapeHtml(String(options.errorCode));

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light;
      }
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        font-family: "SF Pro Text", "SF Pro SC", "PingFang SC", "Segoe UI", sans-serif;
        background: #f7f8fa;
        color: #1f2937;
      }
      body {
        display: grid;
        place-items: center;
        padding: 24px;
        box-sizing: border-box;
      }
      .card {
        width: min(560px, 100%);
        background: #ffffff;
        border: 1px solid #d7dce6;
        border-radius: 16px;
        padding: 20px;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
      }
      h1 {
        margin: 0 0 10px;
        font-size: 18px;
        line-height: 1.3;
      }
      p {
        margin: 0 0 10px;
        line-height: 1.5;
      }
      .meta {
        margin-top: 12px;
        color: #4b5563;
        font-size: 13px;
        word-break: break-word;
      }
      button {
        margin-top: 14px;
        border: none;
        border-radius: 10px;
        background: #ebbcba;
        color: #1f2937;
        font-size: 14px;
        font-weight: 600;
        padding: 10px 14px;
        cursor: pointer;
      }
      button:hover {
        filter: brightness(0.98);
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${title}</h1>
      <p>Web view did not finish loading after automatic retries.</p>
      <p>Reason: ${description}</p>
      <div class="meta">
        <div>Error code: ${errorCodeText}</div>
        <div>Retry attempts: ${attemptText}</div>
        <div>Target URL: ${safeTargetUrl}</div>
      </div>
      <button id="retryButton" type="button">Retry</button>
    </div>
    <script>
      const targetUrl = ${serializedTargetUrl};
      document.getElementById('retryButton')?.addEventListener('click', () => {
        window.location.assign(targetUrl);
      });
    </script>
  </body>
</html>`;

    return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  }

  private handlePaneLoadFailure(options: {
    paneIndex: number;
    webContents: WebContents;
    errorCode: number;
    errorDescription: string;
    failedUrl: string;
    isMainFrame: boolean;
  }): void {
    const {
      paneIndex,
      webContents,
      errorCode,
      errorDescription,
      failedUrl,
      isMainFrame,
    } = options;
    const previousState = this.paneLoadRecoveryByWebContents.get(webContents.id);
    const pane = this.paneViews[paneIndex];
    const targetUrl = previousState?.targetUrl ?? pane?.url ?? failedUrl;
    const decision = decidePaneLoadRecovery({
      isMainFrame,
      errorCode,
      failedUrl,
      targetUrl,
      maxRetries: PANE_LOAD_MAX_RETRIES,
      previousState,
    });

    if (decision.action === 'ignore') {
      return;
    }

    this.paneLoadRecoveryByWebContents.set(webContents.id, decision.state);

    if (decision.action === 'retry') {
      const expectedAttempt = decision.state.attemptCount;
      const expectedTargetUrl = decision.state.targetUrl;
      const delayMs = PANE_LOAD_RETRY_BASE_DELAY_MS * expectedAttempt;

      setTimeout(() => {
        if (webContents.isDestroyed()) {
          return;
        }

        const latestState = this.paneLoadRecoveryByWebContents.get(webContents.id);
        if (!latestState) {
          return;
        }
        if (
          latestState.targetUrl !== expectedTargetUrl
          || latestState.attemptCount !== expectedAttempt
        ) {
          return;
        }

        webContents.loadURL(expectedTargetUrl).catch((error) => {
          console.error(`[ViewManager] Retry load failed for pane ${paneIndex}:`, error);
        });
      }, delayMs);
      return;
    }

    if (!pane || webContents.isDestroyed()) {
      return;
    }

    const providerName = this.providers.get(pane.providerKey)?.name ?? pane.providerKey;
    const fallbackUrl = this.buildPaneLoadErrorDataUrl({
      providerName,
      targetUrl: decision.state.targetUrl,
      errorCode,
      errorDescription,
      attemptCount: decision.state.attemptCount,
    });

    webContents.loadURL(fallbackUrl).catch((error) => {
      console.error(`[ViewManager] Failed to render load error fallback for pane ${paneIndex}:`, error);
    });
  }

  private attachPaneLoadRecoveryHooks(paneIndex: number, webContents: WebContents): void {
    webContents.on('did-finish-load', () => {
      const state = this.paneLoadRecoveryByWebContents.get(webContents.id);
      if (!state) {
        return;
      }
      const currentUrl = webContents.getURL();
      if (this.areUrlsEquivalent(currentUrl, state.targetUrl)) {
        this.paneLoadRecoveryByWebContents.set(webContents.id, {
          targetUrl: state.targetUrl,
          attemptCount: 0,
        });
      }
    });

    webContents.on(
      'did-fail-load',
      (
        _event: Event,
        errorCode: number,
        errorDescription: string,
        validatedURL: string,
        isMainFrame: boolean
      ) => {
        this.handlePaneLoadFailure({
          paneIndex,
          webContents,
          errorCode,
          errorDescription,
          failedUrl: validatedURL,
          isMainFrame,
        });
      }
    );

    webContents.on('render-process-gone', (_event, details) => {
      const recoveryState = this.paneLoadRecoveryByWebContents.get(webContents.id);
      const pane = this.paneViews[paneIndex];
      const failedUrl = recoveryState?.targetUrl ?? pane?.url ?? '';
      this.handlePaneLoadFailure({
        paneIndex,
        webContents,
        errorCode: -1000,
        errorDescription: `Renderer process gone (${details.reason})`,
        failedUrl,
        isMainFrame: true,
      });
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
    this.attachPaneLoadRecoveryHooks(paneIndex, view.webContents);
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

  private closePane(pane: PaneView): void {
    const uniqueViews = new Set<WebContentsView>();
    for (const cached of pane.cachedViews.values()) {
      uniqueViews.add(cached.view);
    }
    uniqueViews.add(pane.view);

    for (const view of uniqueViews) {
      this.removePaneViewFromContent(view);
      if (!view.webContents.isDestroyed()) {
        this.paneLoadRecoveryByWebContents.delete(view.webContents.id);
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

    // Remove excess panes
    while (this.paneViews.length > count) {
      const pane = this.paneViews.pop()!;
      this.clearProviderLoadingTracking(pane.paneIndex);
      this.closePane(pane);
    }

    // Add missing panes
    while (this.paneViews.length < count) {
      const paneIndex = this.paneViews.length;
      const providerKey = this.defaultProviders[paneIndex] ?? 'chatgpt';
      const provider = this.providers.get(providerKey);
      const url = provider?.url || 'about:blank';
      const view = this.createPaneWebContentsView(paneIndex);

      this.window.contentView.addChildView(view);
      this.loadPaneUrl(paneIndex, view, url, false);

      this.paneViews.push({
        view,
        paneIndex,
        providerKey,
        url,
        cachedViews: new Map([[providerKey, { view, url }]]),
      });
    }

    this.currentPaneCount = count;
    this.quickPromptAnchorPaneIndex = Math.max(
      0,
      Math.min(this.quickPromptAnchorPaneIndex, this.paneViews.length - 1)
    );
    this.keepQuickPromptOnTop();
    this.updateLayout();
  }

  /**
   * Update provider for a specific pane
   */
  updatePaneProvider(paneIndex: number, providerKey: string): boolean {
    if (paneIndex < 0 || paneIndex >= this.paneViews.length) {
      console.error(`[ViewManager] Invalid pane index: ${paneIndex}`);
      return false;
    }

    const provider = this.providers.get(providerKey);
    if (!provider) {
      console.error(`[ViewManager] Unknown provider: ${providerKey}`);
      return false;
    }

    const pane = this.paneViews[paneIndex];
    if (pane.providerKey === providerKey) {
      return true;
    }
    this.setQuickPromptAnchorPaneIndex(paneIndex);

    const cachedViewEntry = pane.cachedViews.get(providerKey);
    if (cachedViewEntry) {
      const cachedCurrentUrl = cachedViewEntry.view.webContents.getURL();
      const shouldReload = !this.areUrlsEquivalent(cachedViewEntry.url, provider.url)
        || !this.areUrlsEquivalent(cachedCurrentUrl, provider.url);

      if (shouldReload) {
        cachedViewEntry.url = provider.url;
        this.applyPaneRuntimePreferences(cachedViewEntry.view.webContents);
        this.loadPaneUrl(paneIndex, cachedViewEntry.view, provider.url, true);
      } else {
        this.clearProviderLoadingTracking(paneIndex);
      }

      if (pane.view !== cachedViewEntry.view) {
        this.removePaneViewFromContent(pane.view);
        this.window.contentView.addChildView(cachedViewEntry.view);
      }

      pane.view = cachedViewEntry.view;
      pane.providerKey = providerKey;
      pane.url = cachedViewEntry.url;
      this.defaultProviders[paneIndex] = providerKey;
      this.applyPaneRuntimePreferences(pane.view.webContents);
      this.keepQuickPromptOnTop();
      this.updateLayout();
      return true;
    }

    const nextView = this.createPaneWebContentsView(paneIndex);
    this.window.contentView.addChildView(nextView);
    this.loadPaneUrl(paneIndex, nextView, provider.url, true);
    pane.cachedViews.set(providerKey, { view: nextView, url: provider.url });

    this.removePaneViewFromContent(pane.view);
    pane.view = nextView;
    pane.providerKey = providerKey;
    pane.url = provider.url;
    this.defaultProviders[paneIndex] = providerKey;
    this.keepQuickPromptOnTop();
    this.updateLayout();

    return true;
  }

  /**
   * Reload all panes to each pane's active provider home page.
   */
  resetAllPanesToProviderHome(): boolean {
    let success = true;

    for (const pane of this.paneViews) {
      const provider = this.providers.get(pane.providerKey);
      if (!provider) {
        success = false;
        this.clearProviderLoadingTracking(pane.paneIndex);
        console.error(`[ViewManager] Cannot reset pane ${pane.paneIndex}: unknown provider ${pane.providerKey}`);
        continue;
      }

      const providerUrl = provider.url;
      const cachedViewEntry = pane.cachedViews.get(pane.providerKey);

      if (cachedViewEntry) {
        cachedViewEntry.url = providerUrl;
        if (pane.view !== cachedViewEntry.view) {
          this.removePaneViewFromContent(pane.view);
          this.window.contentView.addChildView(cachedViewEntry.view);
        }
        pane.view = cachedViewEntry.view;
      } else {
        const nextView = this.createPaneWebContentsView(pane.paneIndex);
        this.window.contentView.addChildView(nextView);
        pane.cachedViews.set(pane.providerKey, { view: nextView, url: providerUrl });
        this.removePaneViewFromContent(pane.view);
        pane.view = nextView;
      }

      this.applyPaneRuntimePreferences(pane.view.webContents);
      this.loadPaneUrl(pane.paneIndex, pane.view, providerUrl, true);
      pane.url = providerUrl;
      this.defaultProviders[pane.paneIndex] = pane.providerKey;
    }

    this.keepQuickPromptOnTop();
    this.updateLayout();
    return success;
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

    const contentSize = this.getContentSize();
    const layout = calculateLayout({
      windowWidth: contentSize.width,
      windowHeight: contentSize.height,
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
    let promptEvalScript: string;

    try {
      promptEvalScript = buildPromptInjectionEvalScript(text);
    } catch (error) {
      return {
        success: false,
        failures: [`invalid-prompt: ${toFailureReason(error)}`],
      };
    }

    return this.executePromptEvalScriptOnAllPanes(promptEvalScript);
  }

  /**
   * Sync prompt draft text to all panes without submitting
   */
  async syncPromptDraftToAll(text: string): Promise<{ success: boolean; failures: string[] }> {
    let draftSyncEvalScript: string;

    try {
      draftSyncEvalScript = buildPromptDraftSyncEvalScript(text);
    } catch (error) {
      return {
        success: false,
        failures: [`invalid-prompt-draft: ${toFailureReason(error)}`],
      };
    }

    return this.executePromptEvalScriptOnAllPanes(draftSyncEvalScript);
  }

  private async executePromptEvalScriptOnAllPanes(
    promptEvalScript: string
  ): Promise<{ success: boolean; failures: string[] }> {
    const failures: string[] = [];
    const injectRuntimeScript = this.getInjectRuntimeScript();
    if (!injectRuntimeScript) {
      return {
        success: false,
        failures: this.paneViews.map((pane) => `pane-${pane.paneIndex}: inject runtime not available`),
      };
    }

    for (const pane of this.paneViews) {
      try {
        await pane.view.webContents.executeJavaScript(injectRuntimeScript, true);
        const result = await pane.view.webContents.executeJavaScript(
          promptEvalScript,
          true
        ) as PromptInjectionResult | undefined;

        if (!result?.success) {
          const reason = result?.reason ?? 'prompt injection failed';
          failures.push(`pane-${pane.paneIndex}: ${reason}`);
        }
      } catch (error) {
        console.error(`[ViewManager] Failed to send prompt to pane ${pane.paneIndex}:`, error);
        failures.push(`pane-${pane.paneIndex}: ${toFailureReason(error)}`);
      }
    }

    return {
      success: failures.length === 0,
      failures,
    };
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
    this.paneLoadRecoveryByWebContents.clear();
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
