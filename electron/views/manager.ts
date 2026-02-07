/**
 * ViewManager - manages sidebar and pane WebContentsViews
 */

import { BaseWindow, WebContents, WebContentsView } from 'electron';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { calculateLayout } from './geometry.js';
import { buildPromptInjectionEvalScript, type PromptInjectionResult } from './promptInjection.js';
import {
  PANE_ACCEPT_LANGUAGES,
  PANE_DEFAULT_ZOOM_FACTOR,
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

const rendererIndexPath = resolveFirstExistingPath([
  join(runtimeDir, '..', 'dist', 'index.html'),
  join(runtimeDir, '..', '..', 'dist', 'index.html'),
]);

const injectRuntimePath = resolveFirstExistingPath([
  join(runtimeDir, 'inject.js'),
  join(runtimeDir, '..', 'inject.js'),
  join(runtimeDir, '..', '..', 'dist-electron', 'inject.js'),
]);

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
  private paneViews: PaneView[] = [];
  private currentPaneCount: PaneCount = 1;
  private currentSidebarWidth: number;
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

  private applyPaneRuntimePreferences(webContents: WebContents): void {
    const rawUserAgent = webContents.getUserAgent();
    webContents.session.setUserAgent(rawUserAgent, PANE_ACCEPT_LANGUAGES);
    webContents.setZoomFactor(PANE_DEFAULT_ZOOM_FACTOR);
  }

  private attachPaneRuntimePreferenceHooks(webContents: WebContents): void {
    webContents.on('did-finish-load', () => {
      this.applyPaneRuntimePreferences(webContents);
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

    // Load sidebar content
    if (process.env.NODE_ENV === 'development') {
      this.sidebarView.webContents.loadURL('http://localhost:5173');
    } else {
      this.sidebarView.webContents.loadFile(rendererIndexPath);
    }

    return this.sidebarView;
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
    const failures: string[] = [];
    let promptEvalScript: string;

    try {
      promptEvalScript = buildPromptInjectionEvalScript(text);
    } catch (error) {
      return {
        success: false,
        failures: [`invalid-prompt: ${toFailureReason(error)}`],
      };
    }

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
