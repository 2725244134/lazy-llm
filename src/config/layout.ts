export const LAYOUT_CONFIG = {
  pane: {
    minCount: 1,
    maxCount: 4,
    defaultCount: 2,
  },
  sidebar: {
    defaultExpandedWidth: 280,
    defaultCollapsedWidth: 48,
    minExpandedWidth: 48,
    maxExpandedWidth: 500,
    minCollapsedWidth: 24,
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
