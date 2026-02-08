import type { AppConfig } from '../ipc/contracts.js';
import { APP_CONFIG } from '../../src/config/app.js';
import { CANONICAL_PROVIDERS, normalizeProviderSequence } from './providerConfig.js';

export { CANONICAL_PROVIDERS } from './providerConfig.js';

export const DEFAULT_CONFIG: AppConfig = {
  sidebar: {
    expanded_width: APP_CONFIG.layout.sidebar.defaultExpandedWidth,
    collapsed_width: APP_CONFIG.layout.sidebar.defaultCollapsedWidth,
  },
  defaults: {
    pane_count: APP_CONFIG.layout.pane.defaultCount,
    providers: [...APP_CONFIG.providers.defaultPaneKeys],
  },
  providers: CANONICAL_PROVIDERS,
};

export function normalizePaneCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return DEFAULT_CONFIG.defaults.pane_count;
  }
  return Math.max(APP_CONFIG.layout.pane.minCount, Math.min(APP_CONFIG.layout.pane.maxCount, value));
}

export function normalizeConfig(config: Partial<AppConfig> | null | undefined): AppConfig {
  const paneCount = normalizePaneCount(config?.defaults?.pane_count);
  const expandedWidthCandidate = config?.sidebar?.expanded_width;
  const normalizedDefaultProviders = normalizeProviderSequence(config?.defaults?.providers, paneCount);

  const expandedWidth = typeof expandedWidthCandidate === 'number' && Number.isFinite(expandedWidthCandidate)
    ? Math.max(APP_CONFIG.layout.sidebar.minExpandedWidth, Math.floor(expandedWidthCandidate))
    : DEFAULT_CONFIG.sidebar.expanded_width;

  return {
    sidebar: {
      expanded_width: expandedWidth,
      // Collapsed width is fixed by product design. Only expanded_width is configurable.
      collapsed_width: DEFAULT_CONFIG.sidebar.collapsed_width,
    },
    defaults: {
      pane_count: paneCount,
      providers: normalizedDefaultProviders,
    },
    providers: CANONICAL_PROVIDERS,
  };
}
