import {
  type Event,
  type Input,
  type WebContents,
  WebContentsView,
  type BaseWindow,
} from 'electron';
import type { ViewRect } from '@shared-contracts/ipc/contracts';
import { QuickPromptAnchorTracker } from './anchorTracker.js';
import {
  QuickPromptLifecycleService,
  type QuickPromptHideOptions,
  type QuickPromptResizeResult,
} from './lifecycleService.js';

export interface QuickPromptControllerOptions {
  hostWindow: BaseWindow;
  quickPromptPreloadPath: string;
  defaultHeight: number;
  minHeight: number;
  maxHeight: number;
  resolveBounds(requestedHeight: number, anchorPaneIndex: number): ViewRect;
  anchorTracker: QuickPromptAnchorTracker;
  focusSidebarIfAvailable(): void;
  attachGlobalShortcutHooks(webContents: WebContents): void;
  buildQuickPromptDataUrl(): string;
}

export class QuickPromptController {
  private readonly quickPromptLifecycleService: QuickPromptLifecycleService;

  constructor(private readonly options: QuickPromptControllerOptions) {
    this.quickPromptLifecycleService = new QuickPromptLifecycleService(
      {
        defaultHeight: options.defaultHeight,
        minHeight: options.minHeight,
        maxHeight: options.maxHeight,
      },
      {
        createQuickPromptView: () => this.createQuickPromptView(),
        addQuickPromptViewToContent: (view) => this.options.hostWindow.contentView.addChildView(view),
        removeQuickPromptViewFromContent: (view) => this.options.hostWindow.contentView.removeChildView(view),
        getQuickPromptBounds: (height) => this.options.resolveBounds(
          height,
          this.options.anchorTracker.getAnchorPaneIndex(),
        ),
        focusQuickPromptView: (view) => view.webContents.focus(),
        focusSidebarIfAvailable: () => this.options.focusSidebarIfAvailable(),
        notifyQuickPromptOpened: (view) => this.notifyQuickPromptOpened(view),
        closeQuickPromptView: (view) => view.webContents.close(),
        updateQuickPromptAnchorFromFocusedWebContents: () =>
          this.options.anchorTracker.updateAnchorFromFocusedWebContents(),
      },
    );
  }

  initQuickPrompt(): WebContentsView {
    return this.quickPromptLifecycleService.ensureView();
  }

  getView(): WebContentsView | null {
    return this.quickPromptLifecycleService.getView();
  }

  isVisible(): boolean {
    return this.quickPromptLifecycleService.isVisible();
  }

  getAnchorPaneIndex(): number {
    return this.options.anchorTracker.getAnchorPaneIndex();
  }

  setAnchorPaneIndex(paneIndex: number): void {
    this.options.anchorTracker.setAnchorPaneIndex(paneIndex);
  }

  toggleQuickPrompt(sourceWebContents?: WebContents): boolean {
    const quickPromptView = this.quickPromptLifecycleService.getView();
    if (
      this.quickPromptLifecycleService.isVisible()
      && quickPromptView
      && !quickPromptView.webContents.isDestroyed()
    ) {
      const sourceIsDifferentView = Boolean(
        sourceWebContents && sourceWebContents.id !== quickPromptView.webContents.id,
      );
      const overlayLostFocusWithoutExplicitSource = !sourceWebContents && !quickPromptView.webContents.isFocused();
      if (sourceIsDifferentView || overlayLostFocusWithoutExplicitSource) {
        this.quickPromptLifecycleService.hide({ restoreFocus: false });
      }
    }

    if (sourceWebContents) {
      this.options.anchorTracker.updateAnchorFromSource(sourceWebContents);
    }

    return this.quickPromptLifecycleService.toggle();
  }

  showQuickPrompt(): boolean {
    return this.quickPromptLifecycleService.show();
  }

  hideQuickPrompt(options?: QuickPromptHideOptions): boolean {
    return this.quickPromptLifecycleService.hide(options);
  }

  resizeQuickPrompt(nextHeight: number): QuickPromptResizeResult {
    return this.quickPromptLifecycleService.resize(nextHeight);
  }

  relayout(): void {
    this.quickPromptLifecycleService.relayout();
  }

  keepOnTop(): void {
    const quickPromptView = this.quickPromptLifecycleService.getView();
    if (!quickPromptView || !this.quickPromptLifecycleService.isVisible()) {
      return;
    }
    this.options.hostWindow.contentView.removeChildView(quickPromptView);
    this.options.hostWindow.contentView.addChildView(quickPromptView);
  }

  destroy(): void {
    this.quickPromptLifecycleService.destroy();
  }

  private createQuickPromptView(): WebContentsView {
    const quickPromptView = new WebContentsView({
      webPreferences: {
        preload: this.options.quickPromptPreloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    quickPromptView.setBackgroundColor('#00000000');
    this.options.attachGlobalShortcutHooks(quickPromptView.webContents);
    this.attachQuickPromptDebugConsoleHooks(quickPromptView.webContents);
    this.attachQuickPromptSubmitShortcutHooks(quickPromptView.webContents);
    quickPromptView.webContents.on('did-finish-load', () => {
      this.quickPromptLifecycleService.markReady();
    });
    quickPromptView.webContents.on('blur', () => {
      this.quickPromptLifecycleService.hide({ restoreFocus: false });
    });
    quickPromptView.webContents.loadURL(this.options.buildQuickPromptDataUrl());

    return quickPromptView;
  }

  private notifyQuickPromptOpened(quickPromptView: WebContentsView): void {
    if (quickPromptView.webContents.isDestroyed()) {
      return;
    }
    quickPromptView.webContents.executeJavaScript(
      `window.dispatchEvent(new Event('quick-prompt:open'));`,
      true,
    ).catch((error) => {
      console.error('[QuickPromptController] Failed to focus quick prompt overlay:', error);
    });
  }

  private attachQuickPromptDebugConsoleHooks(webContents: WebContents): void {
    webContents.on('console-message', (details) => {
      const { level, message, lineNumber } = details;
      if (typeof message !== 'string' || !message.includes('[QuickPromptDebug]')) {
        return;
      }

      const sanitizedMessage = message
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .slice(0, 320);
      console.info('[QuickPromptDebug][QuickPromptConsole]', {
        level,
        message: sanitizedMessage,
        truncated: message.length > 320,
        line: lineNumber,
      });
    });
  }

  private attachQuickPromptSubmitShortcutHooks(webContents: WebContents): void {
    webContents.on('before-input-event', (event: Event, input: Input) => {
      const type = typeof input.type === 'string' ? input.type : '';
      const isKeyDownLike = type === 'keyDown' || type === 'rawKeyDown';
      if (!isKeyDownLike || input.isAutoRepeat || input.isComposing) {
        return;
      }

      const key = typeof input.key === 'string' ? input.key : '';
      const keyLower = key.toLowerCase();
      const isEnterLike = keyLower === 'enter'
        || keyLower === 'return'
        || keyLower === 'numpadenter';
      if (!isEnterLike || input.shift) {
        return;
      }

      event.preventDefault();
      console.info('[QuickPromptDebug][Main] before-input-event triggers quick prompt submit', {
        key,
        type,
        control: Boolean(input.control),
        meta: Boolean(input.meta),
        alt: Boolean(input.alt),
      });
      webContents.executeJavaScript(
        `window.dispatchEvent(new Event('quick-prompt:submit'));`,
        true,
      ).catch((error) => {
        console.error('[QuickPromptDebug][Main] Failed to dispatch quick-prompt:submit event:', error);
      });
    });
  }
}
