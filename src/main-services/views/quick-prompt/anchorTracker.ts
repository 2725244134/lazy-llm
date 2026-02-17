export interface QuickPromptAnchorTrackerOptions {
  initialAnchorPaneIndex?: number;
}

export class QuickPromptAnchorTracker {
  private anchorPaneIndex: number;

  constructor(options: QuickPromptAnchorTrackerOptions = {}) {
    this.anchorPaneIndex = options.initialAnchorPaneIndex ?? 0;
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
}
