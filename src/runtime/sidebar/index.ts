import type { SidebarRuntime, PaneCount, AppConfig } from './types';
import { createElectronRuntime } from './electronRuntime';

export type { SidebarRuntime, PaneCount, AppConfig };

// Fallback runtime for web-only mode (no Electron)
function createFallbackRuntime(): SidebarRuntime {
  const defaultConfig: AppConfig = {
    sidebar: {
      expanded_width: 280,
      collapsed_width: 64,
    },
    defaults: {
      pane_count: 2,
      providers: ['chatgpt', 'claude'],
    },
    providers: [
      { key: 'chatgpt', name: 'ChatGPT', url: 'https://chat.openai.com' },
      { key: 'claude', name: 'Claude', url: 'https://claude.ai' },
      { key: 'gemini', name: 'Gemini', url: 'https://gemini.google.com' },
      { key: 'grok', name: 'Grok', url: 'https://grok.x.ai' },
    ],
  };

  return {
    async getConfig() {
      return defaultConfig;
    },
    async setPaneCount(_count) {
      // No-op in fallback mode
    },
    async updateProvider(_paneIndex, _providerKey, _totalPanes) {
      // No-op in fallback mode
    },
    async updateLayout(_args) {
      // No-op in fallback mode
    },
    async sendPrompt(_text) {
      console.log('[Fallback] sendPrompt called, but no runtime available');
    },
  };
}

let runtimeInstance: SidebarRuntime | null = null;

export function getSidebarRuntime(): SidebarRuntime {
  if (runtimeInstance) {
    return runtimeInstance;
  }

  if (typeof window !== 'undefined' && window.council) {
    runtimeInstance = createElectronRuntime();
  } else {
    runtimeInstance = createFallbackRuntime();
  }

  return runtimeInstance;
}
