import type { AppConfig } from '@shared-contracts/ipc/contracts';
import { APP_CONFIG } from '@shared-config/src/app.js';
import {
  CANONICAL_PROVIDERS,
  buildDefaultPaneProviders,
  normalizeProviderSequence,
} from './providerConfig.js';
import { buildAppConfigPayload } from './appConfigPayload.js';

export { CANONICAL_PROVIDERS } from './providerConfig.js';

export const DEFAULT_CONFIG: AppConfig = buildAppConfigPayload({
  paneCount: APP_CONFIG.layout.pane.defaultCount,
  paneProviders: buildDefaultPaneProviders(APP_CONFIG.layout.pane.defaultCount),
  providerCatalog: CANONICAL_PROVIDERS,
  sidebarExpandedWidth: APP_CONFIG.layout.sidebar.defaultExpandedWidth,
  quickPromptHeight: APP_CONFIG.layout.quickPrompt.defaultHeight,
});

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

  return buildAppConfigPayload({
    paneCount,
    paneProviders: normalizedPanes,
    providerCatalog: CANONICAL_PROVIDERS,
    sidebarExpandedWidth: expandedWidth,
    quickPromptHeight: normalizeQuickPromptHeight(config?.quick_prompt?.default_height),
  });
}
