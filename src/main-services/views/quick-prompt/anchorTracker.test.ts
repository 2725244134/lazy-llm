import { describe, expect, it } from 'vitest';
import { QuickPromptAnchorTracker } from './anchorTracker';

describe('QuickPromptAnchorTracker', () => {
  it('defaults anchor pane index to zero', () => {
    const tracker = new QuickPromptAnchorTracker();

    expect(tracker.getAnchorPaneIndex()).toBe(0);
  });

  it('accepts configured initial anchor pane index', () => {
    const tracker = new QuickPromptAnchorTracker({
      initialAnchorPaneIndex: 2,
    });

    expect(tracker.getAnchorPaneIndex()).toBe(2);
  });

  it('ignores invalid anchor pane index updates', () => {
    const tracker = new QuickPromptAnchorTracker({
      initialAnchorPaneIndex: 1,
    });

    tracker.setAnchorPaneIndex(-1);
    tracker.setAnchorPaneIndex(1.1);
    expect(tracker.getAnchorPaneIndex()).toBe(1);
  });

  it('updates anchor pane index for valid integer inputs', () => {
    const tracker = new QuickPromptAnchorTracker({
      initialAnchorPaneIndex: 0,
    });

    tracker.setAnchorPaneIndex(3);

    expect(tracker.getAnchorPaneIndex()).toBe(3);
  });

  it('keeps previous anchor when update input is invalid', () => {
    const tracker = new QuickPromptAnchorTracker({
      initialAnchorPaneIndex: 1,
    });

    tracker.setAnchorPaneIndex(NaN);
    tracker.setAnchorPaneIndex(-10);

    expect(tracker.getAnchorPaneIndex()).toBe(1);
  });
});
