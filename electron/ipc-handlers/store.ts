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

const defaults: StoreSchema = {
  config: {
    sidebar: {
      expanded_width: 280,
      collapsed_width: 48,
    },
    defaults: {
      pane_count: 2,
      providers: ['chatgpt', 'claude'],
    },
    providers: [
      {
        key: 'chatgpt',
        name: 'ChatGPT',
        url: 'https://chat.openai.com',
      },
      {
        key: 'claude',
        name: 'Claude',
        url: 'https://claude.ai',
      },
      {
        key: 'gemini',
        name: 'Gemini',
        url: 'https://gemini.google.com',
      },
      {
        key: 'copilot',
        name: 'Copilot',
        url: 'https://copilot.microsoft.com',
      },
    ],
  },
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
  return store.get('config');
}

export function getSession() {
  return store.get('session');
}

export function setSession(session: Partial<StoreSchema['session']>) {
  const current = store.get('session');
  store.set('session', { ...current, ...session });
}
