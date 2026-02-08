import Store from 'electron-store';
import pkg from 'node-machine-id';
const { machineIdSync } = pkg;
import type { AppConfig } from '../ipc/contracts.js';
import { APP_CONFIG } from '../../src/config/app.js';
import { DEFAULT_CONFIG, normalizeConfig } from './configNormalization.js';

// Machine-derived encryption key (not hardcoded)
const encryptionKey = machineIdSync();

interface StoreSchema {
  config: AppConfig;
  session: {
    lastPaneCount: number;
    lastProviders: string[];
  };
}

const defaults: StoreSchema = {
  config: DEFAULT_CONFIG,
  session: {
    lastPaneCount: APP_CONFIG.layout.pane.defaultCount,
    lastProviders: [...APP_CONFIG.providers.defaultPaneKeys],
  },
};

export const store = new Store<StoreSchema>({
  name: 'lazy-llm-config',
  encryptionKey,
  defaults,
});

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

export function setDefaultPaneCount(paneCount: number): AppConfig {
  const current = getConfig();
  const fallbackProvider = current.defaults.providers[0] ?? 'chatgpt';
  const nextProviders = Array.from({ length: paneCount }, (_, paneIndex) => {
    return current.defaults.providers[paneIndex] ?? fallbackProvider;
  });

  const nextConfig = normalizeConfig({
    ...current,
    defaults: {
      ...current.defaults,
      pane_count: paneCount,
      providers: nextProviders,
    },
  });

  store.set('config', nextConfig);
  return nextConfig;
}

export function setDefaultProvider(paneIndex: number, providerKey: string): AppConfig {
  const current = getConfig();
  const fallbackProvider = current.defaults.providers[0] ?? 'chatgpt';
  const nextProviders = Array.from(
    { length: current.defaults.pane_count },
    (_, index) => current.defaults.providers[index] ?? fallbackProvider
  );

  if (paneIndex >= 0 && paneIndex < nextProviders.length) {
    nextProviders[paneIndex] = providerKey;
  }

  const nextConfig = normalizeConfig({
    ...current,
    defaults: {
      ...current.defaults,
      providers: nextProviders,
    },
  });

  store.set('config', nextConfig);
  return nextConfig;
}
