import type { AppConfig } from '@shared-contracts/ipc/contracts';
import { APP_CONFIG } from '@shared-config/src/app.js';
import { DEFAULT_CONFIG, normalizeConfig } from './configNormalization.js';
import { padProviderSequence } from './providerConfig.js';

export interface RuntimePreferences {
  paneZoomFactor: number;
  sidebarZoomFactor: number;
}

interface StoreSchema {
  config: AppConfig;
  runtimePreferences: RuntimePreferences;
  session: {
    lastPaneCount: number;
    lastProviders: string[];
  };
}

const defaultRuntimePreferences: RuntimePreferences = {
  paneZoomFactor: APP_CONFIG.runtime.zoom.paneDefaultFactor,
  sidebarZoomFactor: APP_CONFIG.runtime.zoom.sidebarDefaultFactor,
};

const defaultState: StoreSchema = {
  config: normalizeConfig(DEFAULT_CONFIG),
  runtimePreferences: { ...defaultRuntimePreferences },
  session: {
    lastPaneCount: APP_CONFIG.layout.pane.defaultCount,
    lastProviders: [...DEFAULT_CONFIG.provider.panes],
  },
};

let state: StoreSchema = structuredClone(defaultState);

export const store = {
  get<K extends keyof StoreSchema>(key: K): StoreSchema[K] {
    return structuredClone(state[key]);
  },
  set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void {
    state = {
      ...state,
      [key]: structuredClone(value),
    };
  },
};

export interface ResolvedSettings {
  config: AppConfig;
  runtimePreferences: RuntimePreferences;
}

function getStoredNormalizedConfig(): AppConfig {
  const current = store.get('config');
  const normalized = normalizeConfig(current);

  if (JSON.stringify(current) !== JSON.stringify(normalized)) {
    store.set('config', normalized);
  }

  return normalized;
}

function getStoredRuntimePreferences(): RuntimePreferences {
  const current = store.get('runtimePreferences');

  return {
    paneZoomFactor: Number.isFinite(current.paneZoomFactor)
      ? current.paneZoomFactor
      : defaultRuntimePreferences.paneZoomFactor,
    sidebarZoomFactor: Number.isFinite(current.sidebarZoomFactor)
      ? current.sidebarZoomFactor
      : defaultRuntimePreferences.sidebarZoomFactor,
  };
}

export function getResolvedSettings(): ResolvedSettings {
  return {
    config: getStoredNormalizedConfig(),
    runtimePreferences: getStoredRuntimePreferences(),
  };
}

export function getConfig(): AppConfig {
  return getStoredNormalizedConfig();
}

export function getSession(): StoreSchema['session'] {
  return store.get('session');
}

export function setSession(session: Partial<StoreSchema['session']>): void {
  const current = store.get('session');
  store.set('session', { ...current, ...session });
}

export function setDefaultPaneCount(paneCount: number): AppConfig {
  const current = getStoredNormalizedConfig();
  const nextProviders = padProviderSequence(current.provider.panes, paneCount);

  const nextConfig = normalizeConfig({
    ...current,
    provider: {
      ...current.provider,
      pane_count: paneCount,
      panes: nextProviders,
    },
  });

  store.set('config', nextConfig);
  setSession({
    lastPaneCount: nextConfig.provider.pane_count,
    lastProviders: [...nextConfig.provider.panes],
  });
  return nextConfig;
}

export function setDefaultProvider(paneIndex: number, providerKey: string): AppConfig {
  const current = getStoredNormalizedConfig();
  const nextProviders = padProviderSequence(current.provider.panes, current.provider.pane_count);

  if (paneIndex >= 0 && paneIndex < nextProviders.length) {
    nextProviders[paneIndex] = providerKey;
  }

  const nextConfig = normalizeConfig({
    ...current,
    provider: {
      ...current.provider,
      panes: nextProviders,
    },
  });

  store.set('config', nextConfig);
  setSession({
    lastPaneCount: nextConfig.provider.pane_count,
    lastProviders: [...nextConfig.provider.panes],
  });
  return nextConfig;
}

export function resetStoreStateForTests(): void {
  state = structuredClone(defaultState);
}
