import type { PaneCount, ViewRect } from '../ipc/contracts.js';
import { calculateLayout, type LayoutResult } from './geometry.js';
import { calculateQuickPromptBounds } from './quickPromptGeometry.js';

export interface ContentSize {
  width: number;
  height: number;
}

export interface LayoutCalculationInput {
  contentBounds: ContentSize;
  sidebarWidth: number;
  paneCount: PaneCount;
}

export interface LayoutCalculationResult {
  contentSize: ContentSize;
  layout: LayoutResult;
}

export interface PaneAreaFallbackInput {
  contentSize: ContentSize;
  sidebarWidth: number;
}

export interface QuickPromptAnchorInput {
  contentSize: ContentSize;
  sidebarWidth: number;
  lastLayout: LayoutResult | null;
  anchorPaneIndex: number;
}

export interface QuickPromptLayoutConfig {
  passthroughMode: boolean;
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  viewportPadding: number;
}

export interface QuickPromptBoundsInput {
  contentBounds: ContentSize;
  sidebarWidth: number;
  lastLayout: LayoutResult | null;
  anchorPaneIndex: number;
  requestedHeight: number;
}

export interface QuickPromptBoundsCalculationInput extends QuickPromptBoundsInput {
  quickPromptConfig: QuickPromptLayoutConfig;
}

export function sanitizeContentSize(contentBounds: ContentSize): ContentSize {
  return {
    width: Math.max(1, contentBounds.width),
    height: Math.max(1, contentBounds.height),
  };
}

export function getPaneAreaFallbackBounds(input: PaneAreaFallbackInput): ViewRect {
  const contentSize = sanitizeContentSize(input.contentSize);
  const paneAreaX = Math.max(0, Math.min(input.sidebarWidth, contentSize.width - 1));

  return {
    x: paneAreaX,
    y: 0,
    width: Math.max(1, contentSize.width - paneAreaX),
    height: contentSize.height,
  };
}

export function getQuickPromptAnchorBounds(input: QuickPromptAnchorInput): ViewRect {
  const contentSize = sanitizeContentSize(input.contentSize);
  return {
    x: 0,
    y: 0,
    width: contentSize.width,
    height: contentSize.height,
  };
}

export function calculateLayoutFromContentBounds(
  input: LayoutCalculationInput
): LayoutCalculationResult {
  const contentSize = sanitizeContentSize(input.contentBounds);

  return {
    contentSize,
    layout: calculateLayout({
      windowWidth: contentSize.width,
      windowHeight: contentSize.height,
      sidebarWidth: input.sidebarWidth,
      paneCount: input.paneCount,
    }),
  };
}

export function calculateQuickPromptBoundsForState(
  input: QuickPromptBoundsCalculationInput
): ViewRect {
  const contentSize = sanitizeContentSize(input.contentBounds);
  const anchor = getQuickPromptAnchorBounds({
    contentSize,
    sidebarWidth: input.sidebarWidth,
    lastLayout: input.lastLayout,
    anchorPaneIndex: input.anchorPaneIndex,
  });

  return calculateQuickPromptBounds({
    viewport: contentSize,
    anchor,
    requestedHeight: input.requestedHeight,
    passthroughMode: input.quickPromptConfig.passthroughMode,
    minWidth: input.quickPromptConfig.minWidth,
    maxWidth: input.quickPromptConfig.maxWidth,
    minHeight: input.quickPromptConfig.minHeight,
    maxHeight: input.quickPromptConfig.maxHeight,
    viewportPadding: input.quickPromptConfig.viewportPadding,
  });
}

export class LayoutService {
  constructor(private readonly quickPromptConfig: QuickPromptLayoutConfig) {}

  getSanitizedContentSize(contentBounds: ContentSize): ContentSize {
    return sanitizeContentSize(contentBounds);
  }

  computeLayout(input: LayoutCalculationInput): LayoutCalculationResult {
    return calculateLayoutFromContentBounds(input);
  }

  computePaneAreaFallbackBounds(input: PaneAreaFallbackInput): ViewRect {
    return getPaneAreaFallbackBounds(input);
  }

  computeQuickPromptAnchorBounds(input: QuickPromptAnchorInput): ViewRect {
    return getQuickPromptAnchorBounds(input);
  }

  computeQuickPromptBounds(input: QuickPromptBoundsInput): ViewRect {
    return calculateQuickPromptBoundsForState({
      ...input,
      quickPromptConfig: this.quickPromptConfig,
    });
  }
}
