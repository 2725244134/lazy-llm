import type { AppConfig } from '../ipc/contracts.js';

export const CANONICAL_PROVIDERS: AppConfig['providers'] = [
  {
    key: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com/',
  },
  {
    key: 'claude',
    name: 'Claude',
    url: 'https://claude.ai/',
  },
  {
    key: 'gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com/',
  },
  {
    key: 'grok',
    name: 'Grok',
    url: 'https://grok.com/',
  },
  {
    key: 'perplexity',
    name: 'Perplexity',
    url: 'https://www.perplexity.ai/',
  },
  {
    key: 'aistudio',
    name: 'AI Studio',
    url: 'https://aistudio.google.com/prompts/new_chat',
  },
];

export const DEFAULT_CONFIG: AppConfig = {
  sidebar: {
    expanded_width: 280,
    collapsed_width: 48,
  },
  defaults: {
    pane_count: 2,
    providers: ['chatgpt', 'claude'],
  },
  providers: CANONICAL_PROVIDERS,
};

export function normalizePaneCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return DEFAULT_CONFIG.defaults.pane_count;
  }
  return Math.max(1, Math.min(4, value));
}

export function normalizeConfig(config: Partial<AppConfig> | null | undefined): AppConfig {
  const validProviderKeys = new Set(CANONICAL_PROVIDERS.map((provider) => provider.key));
  const fallbackProvider = CANONICAL_PROVIDERS[0]?.key ?? 'chatgpt';
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
    ? Math.max(48, Math.floor(expandedWidthCandidate))
    : DEFAULT_CONFIG.sidebar.expanded_width;

  const collapsedWidth = typeof collapsedWidthCandidate === 'number' && Number.isFinite(collapsedWidthCandidate)
    ? Math.max(24, Math.floor(collapsedWidthCandidate))
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
