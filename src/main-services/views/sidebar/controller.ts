import { BaseWindow, type WebContents, WebContentsView } from 'electron';
import {
  SidebarEventBridge,
  type ProviderLoadingTrackedWebContents,
} from './eventBridge.js';

export interface SidebarControllerOptions {
  hostWindow: BaseWindow;
  sidebarPreloadPath: string;
  rendererDevServerUrl: string | null;
  rendererIndexPath: string;
  providerLoadingEventName: string;
  sidebarZoomFactor: number;
  attachGlobalShortcutHooks(webContents: WebContents): void;
}

export class SidebarController {
  private sidebarView: WebContentsView | null = null;
  private readonly sidebarEventBridge: SidebarEventBridge;

  constructor(private readonly options: SidebarControllerOptions) {
    this.sidebarEventBridge = new SidebarEventBridge({
      getSidebarTarget: () => this.sidebarView?.webContents ?? null,
      providerLoadingEventName: options.providerLoadingEventName,
    });
  }

  initSidebar(): WebContentsView {
    if (this.sidebarView) {
      return this.sidebarView;
    }

    const view = new WebContentsView({
      webPreferences: {
        preload: this.options.sidebarPreloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    this.sidebarView = view;
    this.options.hostWindow.contentView.addChildView(view);
    this.options.attachGlobalShortcutHooks(view.webContents);
    this.attachSidebarRuntimePreferenceHooks(view.webContents);
    this.applySidebarRuntimePreferences(view.webContents);

    if (this.options.rendererDevServerUrl) {
      view.webContents.loadURL(this.options.rendererDevServerUrl);
    } else {
      view.webContents.loadFile(this.options.rendererIndexPath);
    }

    return view;
  }

  getView(): WebContentsView | null {
    return this.sidebarView;
  }

  setBounds(bounds: Parameters<WebContentsView['setBounds']>[0]): void {
    if (!this.sidebarView) {
      return;
    }
    this.sidebarView.setBounds(bounds);
  }

  focusIfAvailable(): void {
    if (!this.sidebarView) {
      return;
    }
    if (!this.sidebarView.webContents.isDestroyed()) {
      this.sidebarView.webContents.focus();
    }
  }

  dispatchShortcutEvent(eventName: string): void {
    this.sidebarEventBridge.dispatchEvent(eventName);
  }

  dispatchCustomEvent(eventName: string, detail: unknown): void {
    this.sidebarEventBridge.dispatchCustomEvent(eventName, detail);
  }

  clearProviderLoadingTracking(paneIndex: number): void {
    this.sidebarEventBridge.clearProviderLoadingTracking(paneIndex);
  }

  beginProviderLoadingTracking(
    paneIndex: number,
    webContents: ProviderLoadingTrackedWebContents,
  ): void {
    this.sidebarEventBridge.beginProviderLoadingTracking(paneIndex, webContents);
  }

  destroy(): void {
    if (!this.sidebarView) {
      return;
    }

    try {
      this.options.hostWindow.contentView.removeChildView(this.sidebarView);
      this.sidebarView.webContents.close();
    } catch (error) {
      console.error('[SidebarController] Error closing sidebar:', error);
    }

    this.sidebarView = null;
  }

  private applySidebarRuntimePreferences(webContents: WebContents): void {
    webContents.setZoomFactor(this.options.sidebarZoomFactor);
  }

  private attachSidebarRuntimePreferenceHooks(webContents: WebContents): void {
    webContents.on('did-finish-load', () => {
      this.applySidebarRuntimePreferences(webContents);
    });
  }
}
