import { type WebContents, webContents as electronWebContents } from 'electron';

export interface QuickPromptAnchorTrackerOptions {
  resolvePaneIndexByWebContents(webContents: WebContents): number | null;
  getFocusedWebContents?(): WebContents | null;
  initialAnchorPaneIndex?: number;
}

export class QuickPromptAnchorTracker {
  private anchorPaneIndex: number;
  private readonly getFocusedWebContents: () => WebContents | null;

  constructor(private readonly options: QuickPromptAnchorTrackerOptions) {
    this.anchorPaneIndex = options.initialAnchorPaneIndex ?? 0;
    this.getFocusedWebContents = options.getFocusedWebContents
      ? options.getFocusedWebContents
      : () => electronWebContents.getFocusedWebContents();
  }

  getAnchorPaneIndex(): number {
    return this.anchorPaneIndex;
  }

  setAnchorPaneIndex(paneIndex: number): void {
    if (!Number.isInteger(paneIndex) || paneIndex < 0) {
      return;
    }
    this.anchorPaneIndex = paneIndex;
  }

  updateAnchorFromSource(sourceWebContents?: WebContents): void {
    if (sourceWebContents) {
      const paneIndex = this.options.resolvePaneIndexByWebContents(sourceWebContents);
      if (paneIndex !== null) {
        this.setAnchorPaneIndex(paneIndex);
        return;
      }
    }
    this.updateAnchorFromFocusedWebContents();
  }

  updateAnchorFromFocusedWebContents(): void {
    const focusedWebContents = this.getFocusedWebContents();
    if (!focusedWebContents) {
      return;
    }
    const paneIndex = this.options.resolvePaneIndexByWebContents(focusedWebContents);
    if (paneIndex !== null) {
      this.setAnchorPaneIndex(paneIndex);
    }
  }
}
