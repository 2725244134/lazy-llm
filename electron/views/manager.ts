/**
 * ViewManager - manages sidebar and pane WebContentsViews
 */

import { BaseWindow, type Event, type Input, WebContents, WebContentsView } from 'electron';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { calculateLayout } from './geometry.js';
import {
  buildPromptDraftSyncEvalScript,
  buildPromptInjectionEvalScript,
  type PromptInjectionResult,
} from './promptInjection.js';
import { buildQuickPromptDataUrl } from './quick-prompt/index.js';
import {
  PANE_ACCEPT_LANGUAGES,
  PANE_DEFAULT_ZOOM_FACTOR,
  SIDEBAR_DEFAULT_ZOOM_FACTOR,
} from './paneRuntimePreferences.js';
import { getConfig } from '../ipc-handlers/store.js';
import type {
  PaneCount,
  LayoutSnapshot,
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

const QUICK_PROMPT_PASSTHROUGH_MODE = true;
const QUICK_PROMPT_MAX_WIDTH = 560;
const QUICK_PROMPT_MIN_WIDTH = 280;
const QUICK_PROMPT_DEFAULT_HEIGHT = 74;
const QUICK_PROMPT_MIN_HEIGHT = 66;
const QUICK_PROMPT_MAX_HEIGHT = 320;
const QUICK_PROMPT_VIEWPORT_PADDING = 16;
const SIDEBAR_TOGGLE_SHORTCUT_EVENT = 'lazyllm:shortcut-toggle-sidebar';

interface PaneView {
  view: WebContentsView;
  paneIndex: number;
  providerKey: string;
  url: string;
}

function toFailureReason(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
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
  private quickPromptHeight = QUICK_PROMPT_DEFAULT_HEIGHT;
  private providers: Map<string, ProviderMeta>;
  private injectRuntimeScript: string | null = null;

  constructor(window: BaseWindow) {
    this.window = window;

    // Load config
    const config = getConfig();
    this.currentSidebarWidth = config.sidebar.expanded_width;
    this.providers = new Map(config.providers.map(p => [p.key, p]));
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

  private getQuickPromptBounds(): { x: number; y: number; width: number; height: number } {
    const contentSize = this.getContentSize();
    if (!QUICK_PROMPT_PASSTHROUGH_MODE) {
      return {
        x: 0,
        y: 0,
        width: contentSize.width,
        height: contentSize.height,
      };
    }

    const maxAvailableWidth = Math.max(
      240,
      contentSize.width - QUICK_PROMPT_VIEWPORT_PADDING * 2
    );
    const minWidth = Math.min(QUICK_PROMPT_MIN_WIDTH, maxAvailableWidth);
    const width = Math.max(minWidth, Math.min(QUICK_PROMPT_MAX_WIDTH, maxAvailableWidth));
    const maxHeightByViewport = Math.max(
      QUICK_PROMPT_MIN_HEIGHT,
      contentSize.height - QUICK_PROMPT_VIEWPORT_PADDING * 2
    );
    const desiredHeight = Math.max(
      QUICK_PROMPT_MIN_HEIGHT,
      Math.min(QUICK_PROMPT_MAX_HEIGHT, this.quickPromptHeight)
    );
    const height = Math.min(desiredHeight, maxHeightByViewport);
    const x = Math.max(0, Math.floor((contentSize.width - width) / 2));
    const maxY = Math.max(0, contentSize.height - height - QUICK_PROMPT_VIEWPORT_PADDING);
    const centeredY = Math.floor((contentSize.height - height) / 2);
    const y = Math.max(QUICK_PROMPT_VIEWPORT_PADDING, Math.min(centeredY, maxY));

    return {
      x,
      y,
      width,
      height,
    };
  }

  private attachGlobalShortcutHooks(webContents: WebContents): void {
    webContents.on('before-input-event', (event: Event, input: Input) => {
      this.handleGlobalShortcut(event, input);
    });
  }

  private handleGlobalShortcut(event: Event, input: Input): void {
    const isKeyDownLike = input.type === 'keyDown' || input.type === 'rawKeyDown';
    if (!isKeyDownLike || input.isAutoRepeat) {
      return;
    }

    const key = typeof input.key === 'string' ? input.key.toLowerCase() : '';
    const isShortcutModifier = Boolean(input.control || input.meta);
    const isBaseShortcut = isShortcutModifier && !input.alt && !input.shift;

    if (isBaseShortcut && key === 'j') {
      event.preventDefault();
      this.toggleQuickPrompt();
      return;
    }

    if (isBaseShortcut && key === 'b') {
      event.preventDefault();
      this.notifySidebarToggleShortcut();
    }
  }

  private applyPaneRuntimePreferences(webContents: WebContents): void {
    const rawUserAgent = webContents.getUserAgent();
    webContents.session.setUserAgent(rawUserAgent, PANE_ACCEPT_LANGUAGES);
    webContents.setZoomFactor(PANE_DEFAULT_ZOOM_FACTOR);
  }

  private applySidebarRuntimePreferences(webContents: WebContents): void {
    webContents.setZoomFactor(SIDEBAR_DEFAULT_ZOOM_FACTOR);
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

    this.quickPromptHeight = QUICK_PROMPT_DEFAULT_HEIGHT;
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
    this.quickPromptHeight = QUICK_PROMPT_DEFAULT_HEIGHT;
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

  /**
   * Set pane count, creating or destroying WebContentsViews as needed
   */
  setPaneCount(count: PaneCount): void {
    const config = getConfig();
    const defaultProviders = config.defaults.providers;

    // Remove excess panes
    while (this.paneViews.length > count) {
      const pane = this.paneViews.pop()!;
      this.window.contentView.removeChildView(pane.view);
      pane.view.webContents.close();
    }

    // Add missing panes
    while (this.paneViews.length < count) {
      const paneIndex = this.paneViews.length;
      const providerKey = defaultProviders[paneIndex] || defaultProviders[0] || 'chatgpt';
      const provider = this.providers.get(providerKey);
      const url = provider?.url || 'about:blank';

      const view = new WebContentsView({
        webPreferences: {
          preload: panePreloadPath,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          additionalArguments: [`--pane-index=${paneIndex}`],
        },
      });

      this.window.contentView.addChildView(view);
      this.attachGlobalShortcutHooks(view.webContents);
      this.attachPaneRuntimePreferenceHooks(view.webContents);
      this.applyPaneRuntimePreferences(view.webContents);
      view.webContents.loadURL(url);

      this.paneViews.push({
        view,
        paneIndex,
        providerKey,
        url,
      });
    }

    this.currentPaneCount = count;
    if (this.quickPromptVisible && this.quickPromptView) {
      this.window.contentView.removeChildView(this.quickPromptView);
      this.window.contentView.addChildView(this.quickPromptView);
    }
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
    pane.providerKey = providerKey;
    pane.url = provider.url;
    this.applyPaneRuntimePreferences(pane.view.webContents);
    pane.view.webContents.loadURL(provider.url);

    return true;
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
   * Get current layout snapshot for testing/debugging
   */
  getSnapshot(): LayoutSnapshot {
    const contentSize = this.getContentSize();
    const sidebarBounds = this.sidebarView?.getBounds() || { x: 0, y: 0, width: 0, height: 0 };
    const quickPromptBounds = this.quickPromptVisible && this.quickPromptView
      ? this.quickPromptView.getBounds()
      : null;

    return {
      windowWidth: contentSize.width,
      windowHeight: contentSize.height,
      sidebar: sidebarBounds,
      paneCount: this.currentPaneCount,
      quickPromptVisible: this.quickPromptVisible,
      quickPromptBounds,
      panes: this.paneViews.map(pane => ({
        paneIndex: pane.paneIndex,
        bounds: pane.view.getBounds(),
        providerKey: pane.providerKey,
        url: pane.url,
      })),
    };
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
        this.window.contentView.removeChildView(pane.view);
        pane.view.webContents.close();
      } catch (e) {
        console.error(`[ViewManager] Error closing pane ${pane.paneIndex}:`, e);
      }
    }
    this.paneViews = [];

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
