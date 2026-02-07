/**
 * ViewManager - manages sidebar and pane WebContentsViews
 */

import { BaseWindow, WebContentsView } from 'electron';
import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { calculateLayout } from './geometry.js';
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

interface PaneView {
  view: WebContentsView;
  paneIndex: number;
  providerKey: string;
  url: string;
}

export class ViewManager {
  private window: BaseWindow;
  private sidebarView: WebContentsView | null = null;
  private paneViews: PaneView[] = [];
  private currentPaneCount: PaneCount = 1;
  private currentSidebarWidth: number;
  private providers: Map<string, ProviderMeta>;

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
          partition: `persist:pane-${paneIndex}`,
          additionalArguments: [`--pane-index=${paneIndex}`],
        },
      });

      this.window.contentView.addChildView(view);
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

    for (const pane of this.paneViews) {
      try {
        pane.view.webContents.send('pane:injectPrompt', { text });
      } catch (error) {
        console.error(`[ViewManager] Failed to send prompt to pane ${pane.paneIndex}:`, error);
        failures.push(`pane-${pane.paneIndex}`);
      }
    }

    return {
      success: failures.length === 0,
      failures,
    };
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
