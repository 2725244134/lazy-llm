import Store from 'electron-store';
import pkg from 'node-machine-id';
const { machineIdSync } = pkg;
import type { AppConfig } from '../ipc/contracts.js';

// Machine-derived encryption key (not hardcoded)
const encryptionKey = machineIdSync();

interface StoreSchema {
  config: AppConfig;
  session: {
    lastPaneCount: number;
    lastProviders: string[];
  };
}

const CANONICAL_PROVIDERS: AppConfig['providers'] = [
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

const DEFAULT_CONFIG: AppConfig = {
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

const defaults: StoreSchema = {
  config: DEFAULT_CONFIG,
  session: {
    lastPaneCount: 2,
    lastProviders: ['chatgpt', 'claude'],
  },
};

export const store = new Store<StoreSchema>({
  name: 'lazy-llm-config',
  encryptionKey,
  defaults,
});

function normalizePaneCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return DEFAULT_CONFIG.defaults.pane_count;
  }
  return Math.max(1, Math.min(4, value));
}

function normalizeConfig(config: AppConfig): AppConfig {
  const validProviderKeys = new Set(CANONICAL_PROVIDERS.map((provider) => provider.key));
  const fallbackProvider = CANONICAL_PROVIDERS[0]?.key ?? 'chatgpt';
  const paneCount = normalizePaneCount(config?.defaults?.pane_count);

  const normalizedDefaultProviders = Array.from({ length: paneCount }, (_, paneIndex) => {
    const candidate = config?.defaults?.providers?.[paneIndex];
    if (typeof candidate === 'string' && validProviderKeys.has(candidate)) {
      return candidate;
    }
    return fallbackProvider;
  });

  const expandedWidth = Number.isFinite(config?.sidebar?.expanded_width)
    ? Math.max(48, Math.floor(config.sidebar.expanded_width))
    : DEFAULT_CONFIG.sidebar.expanded_width;

  const collapsedWidth = Number.isFinite(config?.sidebar?.collapsed_width)
    ? Math.max(24, Math.floor(config.sidebar.collapsed_width))
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

export function getConfig(): AppConfig {
  const current = store.get('config');
  const normalized = normalizeConfig(current);

  if (JSON.stringify(current) !== JSON.stringify(normalized)) {
    store.set('config', normalized);
  }

  return normalized;
}

export function getSession() {
  return store.get('session');
}

export function setSession(session: Partial<StoreSchema['session']>) {
  const current = store.get('session');
  store.set('session', { ...current, ...session });
}
