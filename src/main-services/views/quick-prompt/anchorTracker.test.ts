import type { WebContents } from 'electron';
import { describe, expect, it } from 'vitest';
import { QuickPromptAnchorTracker } from './anchorTracker';

function createWebContents(id: number): WebContents {
  return { id } as unknown as WebContents;
}

describe('QuickPromptAnchorTracker', () => {
  it('defaults anchor pane index to zero', () => {
    const tracker = new QuickPromptAnchorTracker({
      resolvePaneIndexByWebContents: () => null,
      getFocusedWebContents: () => null,
    });

    expect(tracker.getAnchorPaneIndex()).toBe(0);
  });

  it('accepts configured initial anchor pane index', () => {
    const tracker = new QuickPromptAnchorTracker({
      resolvePaneIndexByWebContents: () => null,
      getFocusedWebContents: () => null,
      initialAnchorPaneIndex: 2,
    });

    expect(tracker.getAnchorPaneIndex()).toBe(2);
  });

  it('ignores invalid anchor pane index updates', () => {
    const tracker = new QuickPromptAnchorTracker({
      resolvePaneIndexByWebContents: () => null,
      getFocusedWebContents: () => null,
      initialAnchorPaneIndex: 1,
    });

    tracker.setAnchorPaneIndex(-1);
    tracker.setAnchorPaneIndex(1.1);
    expect(tracker.getAnchorPaneIndex()).toBe(1);
  });

  it('updates anchor from source webContents when source maps to a pane', () => {
    const source = createWebContents(100);
    const tracker = new QuickPromptAnchorTracker({
      resolvePaneIndexByWebContents: (webContents) => (webContents.id === source.id ? 3 : null),
      getFocusedWebContents: () => null,
    });

    tracker.updateAnchorFromSource(source);

    expect(tracker.getAnchorPaneIndex()).toBe(3);
  });

  it('falls back to focused webContents when source does not map to a pane', () => {
    const source = createWebContents(200);
    const focused = createWebContents(300);
    const tracker = new QuickPromptAnchorTracker({
      resolvePaneIndexByWebContents: (webContents) => {
        if (webContents.id === focused.id) {
          return 4;
        }
        return null;
      },
      getFocusedWebContents: () => focused,
      initialAnchorPaneIndex: 1,
    });

    tracker.updateAnchorFromSource(source);

    expect(tracker.getAnchorPaneIndex()).toBe(4);
  });

  it('keeps previous anchor when neither source nor focused webContents map to a pane', () => {
    const tracker = new QuickPromptAnchorTracker({
      resolvePaneIndexByWebContents: () => null,
      getFocusedWebContents: () => createWebContents(999),
      initialAnchorPaneIndex: 2,
    });

    tracker.updateAnchorFromSource(createWebContents(111));

    expect(tracker.getAnchorPaneIndex()).toBe(2);
  });
});
