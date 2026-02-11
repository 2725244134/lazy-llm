import Store from 'electron-store';
import pkg from 'node-machine-id';
const { machineIdSync } = pkg;
import type { AppConfig } from '../ipc/contracts.js';
import { APP_CONFIG } from '../../packages/shared-config/src/app.js';
import { DEFAULT_CONFIG, normalizeConfig } from './configNormalization.js';
import { buildDefaultPaneProviders, padProviderSequence } from './providerConfig.js';
import {
  DEFAULT_RUNTIME_PREFERENCES,
  mergeRuntimePreferencesWithExternal,
  mergeAppConfigWithExternal,
  normalizeRuntimePreferences,
  readExternalConfigFile,
  type RuntimePreferences,
} from './externalConfig.js';

// Machine-derived encryption key (not hardcoded)
const encryptionKey = machineIdSync();

interface StoreSchema {
  config: AppConfig;
  runtimePreferences: RuntimePreferences;
  session: {
    lastPaneCount: number;
    lastProviders: string[];
  };
}

const defaults: StoreSchema = {
  config: DEFAULT_CONFIG,
  runtimePreferences: DEFAULT_RUNTIME_PREFERENCES,
  session: {
    lastPaneCount: APP_CONFIG.layout.pane.defaultCount,
    lastProviders: buildDefaultPaneProviders(APP_CONFIG.layout.pane.defaultCount),
  },
};

export const store = new Store<StoreSchema>({
  name: 'lazy-llm-config',
  encryptionKey,
  defaults,
});

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
  const normalized = normalizeRuntimePreferences(current, DEFAULT_RUNTIME_PREFERENCES);

  if (JSON.stringify(current) !== JSON.stringify(normalized)) {
    store.set('runtimePreferences', normalized);
  }

  return normalized;
}

export function getResolvedSettings(): ResolvedSettings {
  const storedConfig = getStoredNormalizedConfig();
  const storedRuntimePreferences = getStoredRuntimePreferences();
  const externalConfig = readExternalConfigFile();

  return {
    config: normalizeConfig(mergeAppConfigWithExternal(storedConfig, externalConfig)),
    runtimePreferences: mergeRuntimePreferencesWithExternal(storedRuntimePreferences, externalConfig),
  };
}

export function getConfig(): AppConfig {
  return getResolvedSettings().config;
}

export function getSession() {
  return store.get('session');
}

export function setSession(session: Partial<StoreSchema['session']>) {
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
  return nextConfig;
}
