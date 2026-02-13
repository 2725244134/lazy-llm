export const LAYOUT_CONFIG = {
  pane: {
    minCount: 1,
    maxCount: 4,
    defaultCount: 3,
  },
  sidebar: {
    defaultExpandedWidth: 200,
    defaultCollapsedWidth: 40,
    minExpandedWidth: 40,
    maxExpandedWidth: 500,
    minCollapsedWidth: 24,
    compactUiMaxWidth: 220,
    tightUiMaxWidth: 180,
    transitionDurationMs: 220,
  },
  quickPrompt: {
    passthroughMode: true,
    minWidth: 280,
    maxWidth: 560,
    defaultHeight: 74,
    minHeight: 66,
    maxHeight: 320,
    viewportPadding: 16,
    panelHeightSafetyGap: 2,
    inputMinHeight: 44,
    inputMaxHeight: 240,
  },
  promptComposer: {
    minTextareaHeight: 124,
    maxTextareaHeight: 280,
  },
} as const;

export type SidebarUiDensity = 'regular' | 'compact' | 'tight';

export function resolveSidebarUiDensity(width: number): SidebarUiDensity {
  if (typeof width !== 'number' || !Number.isFinite(width)) {
    return 'regular';
  }

  const normalizedWidth = Math.max(1, Math.floor(width));
  if (normalizedWidth <= LAYOUT_CONFIG.sidebar.tightUiMaxWidth) {
    return 'tight';
  }
  if (normalizedWidth <= LAYOUT_CONFIG.sidebar.compactUiMaxWidth) {
    return 'compact';
  }
  return 'regular';
}
