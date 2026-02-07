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
const QUICK_PROMPT_MAX_WIDTH = 960;
const QUICK_PROMPT_MIN_WIDTH = 360;
const QUICK_PROMPT_HEIGHT = 162;
const QUICK_PROMPT_MIN_TOP = 96;
const QUICK_PROMPT_TOP_RATIO = 0.22;
const QUICK_PROMPT_VIEWPORT_PADDING = 16;

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

function buildQuickPromptDataUrl(): string {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Quick Prompt</title>
    <style>
      :root { color-scheme: light dark; }
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        background: transparent;
        overflow: hidden;
        font-family: "SF Pro Text", "SF Pro SC", "PingFang SC", "Segoe UI", sans-serif;
      }
      body {
        display: flex;
        align-items: stretch;
        justify-content: center;
      }
      .panel {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        padding: 12px 14px 10px;
        border-radius: 18px;
        border: 1px solid rgba(148, 163, 184, 0.35);
        background: rgba(255, 255, 255, 0.9);
        box-shadow: 0 12px 36px rgba(15, 23, 42, 0.26);
        backdrop-filter: blur(10px) saturate(130%);
      }
      @media (prefers-color-scheme: dark) {
        .panel {
          border-color: rgba(100, 116, 139, 0.52);
          background: rgba(22, 27, 34, 0.9);
        }
      }
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 6px;
      }
      .title {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.7px;
        text-transform: uppercase;
        color: #475569;
      }
      .shortcut {
        font-size: 11px;
        line-height: 1;
        color: #64748b;
        border: 1px solid rgba(148, 163, 184, 0.4);
        border-radius: 999px;
        padding: 4px 8px;
      }
      @media (prefers-color-scheme: dark) {
        .title { color: #cbd5e1; }
        .shortcut {
          color: #94a3b8;
          border-color: rgba(148, 163, 184, 0.35);
        }
      }
      .input {
        width: 100%;
        border: none;
        background: transparent;
        color: #111827;
        font-size: 31px;
        font-weight: 580;
        line-height: 1.2;
        letter-spacing: 0.2px;
      }
      @media (prefers-color-scheme: dark) {
        .input {
          color: #f6f6f6;
        }
      }
      .input::placeholder { color: #6b7280; }
      .input:focus { outline: none; }
      .hint {
        margin-top: 7px;
        font-size: 12px;
        color: #6b7280;
        letter-spacing: 0.12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      @media (max-width: 640px) {
        .panel {
          padding: 10px 12px 9px;
          border-radius: 14px;
        }
        .input { font-size: 22px; }
        .hint { font-size: 11px; }
      }
    </style>
  </head>
  <body>
    <div class="panel" data-testid="quick-prompt-overlay">
      <div class="header">
        <div class="title">Quick Prompt</div>
        <div class="shortcut">Ctrl+J</div>
      </div>
      <div class="dialog" data-testid="quick-prompt-dialog">
        <input
          id="quickPromptInput"
          class="input"
          data-testid="quick-prompt-input"
          type="text"
          placeholder="Just prompt."
          autocomplete="off"
        />
        <div class="hint">Enter to send · Esc to close · Ctrl+J to toggle</div>
      </div>
    </div>
    <script>
      const input = document.getElementById('quickPromptInput');
      let isSending = false;

      const focusInput = () => {
        if (!input) return;
        input.focus();
        const cursorPos = input.value.length;
        input.setSelectionRange(cursorPos, cursorPos);
      };

      const hide = async () => {
        if (!window.quickPrompt || typeof window.quickPrompt.hide !== 'function') return;
        await window.quickPrompt.hide();
      };

      const submit = async () => {
        if (!input || !window.quickPrompt || typeof window.quickPrompt.sendPrompt !== 'function') return;
        const prompt = input.value.trim();
        if (!prompt || isSending) return;

        isSending = true;
        input.disabled = true;
        try {
          await window.quickPrompt.sendPrompt(prompt);
          input.value = '';
          await hide();
        } finally {
          isSending = false;
          input.disabled = false;
        }
      };

      window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          void hide();
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          void submit();
        }
      });

      window.addEventListener('quick-prompt:open', () => {
        if (!input) return;
        input.value = '';
        input.disabled = false;
        isSending = false;
        focusInput();
      });

      window.addEventListener('quick-prompt:focus', focusInput);
    </script>
  </body>
</html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
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
    const height = Math.min(
      QUICK_PROMPT_HEIGHT,
      Math.max(108, contentSize.height - QUICK_PROMPT_VIEWPORT_PADDING * 2)
    );
    const x = Math.max(0, Math.floor((contentSize.width - width) / 2));
    const preferredTop = Math.max(
      QUICK_PROMPT_MIN_TOP,
      Math.floor(contentSize.height * QUICK_PROMPT_TOP_RATIO)
    );
    const maxTop = Math.max(0, contentSize.height - height - QUICK_PROMPT_VIEWPORT_PADDING);
    const y = Math.max(0, Math.min(preferredTop, maxTop));

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

    this.window.contentView.addChildView(this.quickPromptView);
    this.quickPromptView.setBounds(this.getQuickPromptBounds());
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
    this.focusSidebarIfAvailable();
    return this.quickPromptVisible;
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

    return {
      windowWidth: contentSize.width,
      windowHeight: contentSize.height,
      sidebar: sidebarBounds,
      paneCount: this.currentPaneCount,
      quickPromptVisible: this.quickPromptVisible,
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
