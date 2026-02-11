import { describe, expect, it } from 'vitest';
import { calculateLayout } from './geometry';
import { calculateQuickPromptBounds } from './quickPromptGeometry';
import {
  LayoutService,
  calculateLayoutFromContentBounds,
  calculateQuickPromptBoundsForState,
  getPaneAreaFallbackBounds,
  getQuickPromptAnchorBounds,
  sanitizeContentSize,
  type QuickPromptLayoutConfig,
} from './layoutService';

const QUICK_PROMPT_CONFIG: QuickPromptLayoutConfig = {
  passthroughMode: true,
  minWidth: 280,
  maxWidth: 560,
  minHeight: 66,
  maxHeight: 320,
  viewportPadding: 16,
};

describe('sanitizeContentSize', () => {
  it('ensures width and height are at least 1', () => {
    expect(sanitizeContentSize({ width: 0, height: -50 })).toEqual({ width: 1, height: 1 });
  });

  it('keeps positive dimensions unchanged', () => {
    expect(sanitizeContentSize({ width: 1200, height: 800 })).toEqual({ width: 1200, height: 800 });
  });
});

describe('getPaneAreaFallbackBounds', () => {
  it('uses sidebar edge as pane area start when content area is available', () => {
    expect(getPaneAreaFallbackBounds({
      contentSize: { width: 1400, height: 900 },
      sidebarWidth: 280,
    })).toEqual({
      x: 280,
      y: 0,
      width: 1120,
      height: 900,
    });
  });

  it('keeps pane area minimally visible when sidebar exceeds content width', () => {
    expect(getPaneAreaFallbackBounds({
      contentSize: { width: 320, height: 240 },
      sidebarWidth: 1000,
    })).toEqual({
      x: 319,
      y: 0,
      width: 1,
      height: 240,
    });
  });
});

describe('getQuickPromptAnchorBounds', () => {
  it('selects anchor pane by index and clamps out-of-range indices', () => {
    const layout = calculateLayout({
      windowWidth: 1400,
      windowHeight: 900,
      sidebarWidth: 280,
      paneCount: 3,
    });

    expect(getQuickPromptAnchorBounds({
      contentSize: { width: 1400, height: 900 },
      sidebarWidth: 280,
      lastLayout: layout,
      anchorPaneIndex: 1,
    })).toEqual(layout.panes[1]);

    expect(getQuickPromptAnchorBounds({
      contentSize: { width: 1400, height: 900 },
      sidebarWidth: 280,
      lastLayout: layout,
      anchorPaneIndex: -1,
    })).toEqual(layout.panes[0]);

    expect(getQuickPromptAnchorBounds({
      contentSize: { width: 1400, height: 900 },
      sidebarWidth: 280,
      lastLayout: layout,
      anchorPaneIndex: 99,
    })).toEqual(layout.panes[2]);
  });

  it('falls back to pane area when no previous layout exists', () => {
    const contentSize = { width: 900, height: 700 };
    const fallback = getPaneAreaFallbackBounds({ contentSize, sidebarWidth: 1000 });

    expect(getQuickPromptAnchorBounds({
      contentSize,
      sidebarWidth: 1000,
      lastLayout: null,
      anchorPaneIndex: 0,
    })).toEqual(fallback);
  });
});

describe('calculateLayoutFromContentBounds', () => {
  it('sanitizes content size then delegates to calculateLayout', () => {
    const result = calculateLayoutFromContentBounds({
      contentBounds: { width: 0, height: -1 },
      sidebarWidth: 280,
      paneCount: 2,
    });

    expect(result.contentSize).toEqual({ width: 1, height: 1 });
    expect(result.layout).toEqual(calculateLayout({
      windowWidth: 1,
      windowHeight: 1,
      sidebarWidth: 280,
      paneCount: 2,
    }));
  });
});

describe('calculateQuickPromptBoundsForState', () => {
  it('uses selected anchor pane and quick prompt config to compute bounds', () => {
    const contentBounds = { width: 1400, height: 900 };
    const layout = calculateLayout({
      windowWidth: 1400,
      windowHeight: 900,
      sidebarWidth: 280,
      paneCount: 3,
    });

    const actual = calculateQuickPromptBoundsForState({
      contentBounds,
      sidebarWidth: 280,
      lastLayout: layout,
      anchorPaneIndex: 1,
      requestedHeight: 74,
      quickPromptConfig: QUICK_PROMPT_CONFIG,
    });

    const expected = calculateQuickPromptBounds({
      viewport: contentBounds,
      anchor: layout.panes[1],
      requestedHeight: 74,
      passthroughMode: QUICK_PROMPT_CONFIG.passthroughMode,
      minWidth: QUICK_PROMPT_CONFIG.minWidth,
      maxWidth: QUICK_PROMPT_CONFIG.maxWidth,
      minHeight: QUICK_PROMPT_CONFIG.minHeight,
      maxHeight: QUICK_PROMPT_CONFIG.maxHeight,
      viewportPadding: QUICK_PROMPT_CONFIG.viewportPadding,
    });

    expect(actual).toEqual(expected);
  });

  it('falls back to pane area and sanitized content size when layout is missing', () => {
    const contentBounds = { width: 0, height: -2 };
    const viewport = sanitizeContentSize(contentBounds);
    const fallbackAnchor = getPaneAreaFallbackBounds({
      contentSize: viewport,
      sidebarWidth: 999,
    });

    const actual = calculateQuickPromptBoundsForState({
      contentBounds,
      sidebarWidth: 999,
      lastLayout: null,
      anchorPaneIndex: 0,
      requestedHeight: 300,
      quickPromptConfig: QUICK_PROMPT_CONFIG,
    });

    const expected = calculateQuickPromptBounds({
      viewport,
      anchor: fallbackAnchor,
      requestedHeight: 300,
      passthroughMode: QUICK_PROMPT_CONFIG.passthroughMode,
      minWidth: QUICK_PROMPT_CONFIG.minWidth,
      maxWidth: QUICK_PROMPT_CONFIG.maxWidth,
      minHeight: QUICK_PROMPT_CONFIG.minHeight,
      maxHeight: QUICK_PROMPT_CONFIG.maxHeight,
      viewportPadding: QUICK_PROMPT_CONFIG.viewportPadding,
    });

    expect(actual).toEqual(expected);
  });
});

describe('LayoutService', () => {
  it('provides a reusable wrapper over pure layout helpers', () => {
    const service = new LayoutService(QUICK_PROMPT_CONFIG);
    const layoutResult = service.computeLayout({
      contentBounds: { width: 1400, height: 900 },
      sidebarWidth: 280,
      paneCount: 3,
    });

    expect(layoutResult.layout).toEqual(calculateLayout({
      windowWidth: 1400,
      windowHeight: 900,
      sidebarWidth: 280,
      paneCount: 3,
    }));

    const quickPromptBounds = service.computeQuickPromptBounds({
      contentBounds: { width: 1400, height: 900 },
      sidebarWidth: 280,
      lastLayout: layoutResult.layout,
      anchorPaneIndex: 2,
      requestedHeight: 74,
    });

    const expected = calculateQuickPromptBoundsForState({
      contentBounds: { width: 1400, height: 900 },
      sidebarWidth: 280,
      lastLayout: layoutResult.layout,
      anchorPaneIndex: 2,
      requestedHeight: 74,
      quickPromptConfig: QUICK_PROMPT_CONFIG,
    });

    expect(quickPromptBounds).toEqual(expected);
  });
});
