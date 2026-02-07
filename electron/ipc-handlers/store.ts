import Store from 'electron-store';
import pkg from 'node-machine-id';
const { machineIdSync } = pkg;
import type { AppConfig } from '../ipc/contracts.js';
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
    lastPaneCount: 2,
    lastProviders: ['chatgpt', 'claude'],
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
