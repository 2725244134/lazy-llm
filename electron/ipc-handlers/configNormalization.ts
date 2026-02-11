import type { AppConfig } from '../ipc/contracts.js';
import { APP_CONFIG } from '../../packages/shared-config/src/app.js';
import {
  CANONICAL_PROVIDERS,
  buildDefaultPaneProviders,
  normalizeProviderSequence,
} from './providerConfig.js';

export { CANONICAL_PROVIDERS } from './providerConfig.js';

export const DEFAULT_CONFIG: AppConfig = {
  provider: {
    pane_count: APP_CONFIG.layout.pane.defaultCount,
    panes: buildDefaultPaneProviders(APP_CONFIG.layout.pane.defaultCount),
    catalog: CANONICAL_PROVIDERS,
  },
  sidebar: {
    expanded_width: APP_CONFIG.layout.sidebar.defaultExpandedWidth,
    collapsed_width: APP_CONFIG.layout.sidebar.defaultCollapsedWidth,
  },
  quick_prompt: {
    default_height: APP_CONFIG.layout.quickPrompt.defaultHeight,
  },
};

export interface AppConfigDraft {
  provider?: {
    pane_count?: unknown;
    panes?: unknown;
  };
  sidebar?: {
    expanded_width?: unknown;
    collapsed_width?: unknown;
  };
  quick_prompt?: {
    default_height?: unknown;
  };
}

export function normalizePaneCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return DEFAULT_CONFIG.provider.pane_count;
  }
  return Math.max(APP_CONFIG.layout.pane.minCount, Math.min(APP_CONFIG.layout.pane.maxCount, value));
}

export function normalizeQuickPromptHeight(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_CONFIG.quick_prompt.default_height;
  }

  return Math.max(
    APP_CONFIG.layout.quickPrompt.minHeight,
    Math.min(APP_CONFIG.layout.quickPrompt.maxHeight, Math.floor(value))
  );
}

export function normalizeConfig(config: AppConfigDraft | null | undefined): AppConfig {
  const paneCount = normalizePaneCount(config?.provider?.pane_count);
  const expandedWidthCandidate = config?.sidebar?.expanded_width;
  const paneSource = config?.provider?.panes ?? DEFAULT_CONFIG.provider.panes;
  const normalizedPanes = normalizeProviderSequence(paneSource, paneCount);

  const expandedWidth = typeof expandedWidthCandidate === 'number' && Number.isFinite(expandedWidthCandidate)
    ? Math.max(APP_CONFIG.layout.sidebar.minExpandedWidth, Math.floor(expandedWidthCandidate))
    : DEFAULT_CONFIG.sidebar.expanded_width;

  return {
    provider: {
      pane_count: paneCount,
      panes: normalizedPanes,
      catalog: CANONICAL_PROVIDERS,
    },
    sidebar: {
      expanded_width: expandedWidth,
      // Collapsed width is fixed by product design. Only expanded_width is configurable.
      collapsed_width: DEFAULT_CONFIG.sidebar.collapsed_width,
    },
    quick_prompt: {
      default_height: normalizeQuickPromptHeight(config?.quick_prompt?.default_height),
    },
  };
}
