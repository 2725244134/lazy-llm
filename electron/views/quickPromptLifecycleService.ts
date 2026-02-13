import type { WebContentsView } from 'electron';
import type { ViewRect } from '../ipc/contracts.js';

interface QuickPromptHeightConfig {
  defaultHeight: number;
  minHeight: number;
  maxHeight: number;
}

interface QuickPromptLifecycleCallbacks {
  createQuickPromptView(): WebContentsView;
  addQuickPromptViewToContent(view: WebContentsView): void;
  removeQuickPromptViewFromContent(view: WebContentsView): void;
  getQuickPromptBounds(height: number): ViewRect;
  focusQuickPromptView(view: WebContentsView): void;
  focusSidebarIfAvailable(): void;
  notifyQuickPromptOpened(view: WebContentsView): void;
  closeQuickPromptView(view: WebContentsView): void;
  updateQuickPromptAnchorFromFocusedWebContents(): void;
}

export interface QuickPromptResizeResult {
  visible: boolean;
  height: number;
}

export interface QuickPromptHideOptions {
  restoreFocus?: boolean;
}

export class QuickPromptLifecycleService {
  private quickPromptView: WebContentsView | null = null;
  private quickPromptVisible = false;
  private quickPromptReady = false;
  private quickPromptHeight: number;

  constructor(
    private readonly config: QuickPromptHeightConfig,
    private readonly callbacks: QuickPromptLifecycleCallbacks
  ) {
    this.quickPromptHeight = config.defaultHeight;
  }

  ensureView(): WebContentsView {
    if (this.quickPromptView) {
      return this.quickPromptView;
    }

    this.quickPromptView = this.callbacks.createQuickPromptView();
    return this.quickPromptView;
  }

  isVisible(): boolean {
    return this.quickPromptVisible;
  }

  getView(): WebContentsView | null {
    return this.quickPromptView;
  }

  toggle(): boolean {
    if (this.quickPromptVisible) {
      return this.hide();
    }
    return this.show();
  }

  show(): boolean {
    const view = this.ensureView();
    if (this.quickPromptVisible) {
      return this.quickPromptVisible;
    }

    this.callbacks.updateQuickPromptAnchorFromFocusedWebContents();
    this.quickPromptHeight = this.config.defaultHeight;
    this.callbacks.addQuickPromptViewToContent(view);
    view.setBounds(this.callbacks.getQuickPromptBounds(this.quickPromptHeight));
    this.callbacks.focusQuickPromptView(view);
    this.quickPromptVisible = true;

    if (this.quickPromptReady) {
      this.callbacks.notifyQuickPromptOpened(view);
    }

    return this.quickPromptVisible;
  }

  hide(options: QuickPromptHideOptions = {}): boolean {
    if (!this.quickPromptView || !this.quickPromptVisible) {
      return false;
    }

    const { restoreFocus = true } = options;
    this.callbacks.removeQuickPromptViewFromContent(this.quickPromptView);
    this.quickPromptVisible = false;
    this.quickPromptHeight = this.config.defaultHeight;
    if (restoreFocus) {
      this.callbacks.focusSidebarIfAvailable();
    }
    return this.quickPromptVisible;
  }

  resize(nextHeight: number): QuickPromptResizeResult {
    if (!Number.isFinite(nextHeight)) {
      return { visible: this.quickPromptVisible, height: this.quickPromptHeight };
    }

    const clampedHeight = Math.max(
      this.config.minHeight,
      Math.min(this.config.maxHeight, Math.ceil(nextHeight))
    );
    this.quickPromptHeight = clampedHeight;

    if (this.quickPromptVisible && this.quickPromptView) {
      this.quickPromptView.setBounds(this.callbacks.getQuickPromptBounds(this.quickPromptHeight));
    }

    return { visible: this.quickPromptVisible, height: this.quickPromptHeight };
  }

  relayout(): void {
    if (this.quickPromptVisible && this.quickPromptView) {
      this.quickPromptView.setBounds(this.callbacks.getQuickPromptBounds(this.quickPromptHeight));
    }
  }

  markReady(): void {
    this.quickPromptReady = true;
    if (this.quickPromptVisible && this.quickPromptView) {
      this.callbacks.notifyQuickPromptOpened(this.quickPromptView);
    }
  }

  destroy(): void {
    if (!this.quickPromptView) {
      return;
    }

    try {
      if (this.quickPromptVisible) {
        this.callbacks.removeQuickPromptViewFromContent(this.quickPromptView);
      }
    } catch {
      // The view may already be detached from the content tree.
    }

    this.callbacks.closeQuickPromptView(this.quickPromptView);
    this.quickPromptView = null;
    this.quickPromptVisible = false;
    this.quickPromptReady = false;
    this.quickPromptHeight = this.config.defaultHeight;
  }
}
