import type { AppConfig } from '../ipc/contracts.js';
import { APP_CONFIG } from '../../src/config/app.js';

export const CANONICAL_PROVIDERS: AppConfig['providers'] = [
  ...APP_CONFIG.providers.catalog.map((provider) => ({ ...provider })),
];

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
  const validProviderKeys = new Set(CANONICAL_PROVIDERS.map((provider) => provider.key));
  const fallbackProvider = CANONICAL_PROVIDERS[0]?.key ?? APP_CONFIG.providers.catalog[0]?.key ?? 'chatgpt';
  const paneCount = normalizePaneCount(config?.defaults?.pane_count);
  const expandedWidthCandidate = config?.sidebar?.expanded_width;
  const collapsedWidthCandidate = config?.sidebar?.collapsed_width;

  const normalizedDefaultProviders = Array.from({ length: paneCount }, (_, paneIndex) => {
    const candidate = config?.defaults?.providers?.[paneIndex];
    if (typeof candidate === 'string' && validProviderKeys.has(candidate)) {
      return candidate;
    }
    return fallbackProvider;
  });

  const expandedWidth = typeof expandedWidthCandidate === 'number' && Number.isFinite(expandedWidthCandidate)
    ? Math.max(APP_CONFIG.layout.sidebar.minExpandedWidth, Math.floor(expandedWidthCandidate))
    : DEFAULT_CONFIG.sidebar.expanded_width;

  const collapsedWidth = typeof collapsedWidthCandidate === 'number' && Number.isFinite(collapsedWidthCandidate)
    ? Math.max(APP_CONFIG.layout.sidebar.minCollapsedWidth, Math.floor(collapsedWidthCandidate))
    : DEFAULT_CONFIG.sidebar.collapsed_width;

  return {
    sidebar: {
      expanded_width: expandedWidth,
      collapsed_width: Math.min(expandedWidth, collapsedWidth),
    },
    defaults: {
      pane_count: paneCount,
      providers: normalizedDefaultProviders,
    },
    providers: CANONICAL_PROVIDERS,
  };
}
