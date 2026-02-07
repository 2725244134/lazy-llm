import type { AppConfig, PaneCount, SidebarRuntime } from './types';

const fallbackConfig: AppConfig = {
  sidebar: {
    expanded_width: 280,
    collapsed_width: 48,
  },
  defaults: {
    pane_count: 2,
    providers: ['chatgpt', 'claude'],
  },
  providers: [
    { key: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/' },
    { key: 'claude', name: 'Claude', url: 'https://claude.ai/' },
    { key: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/' },
    { key: 'grok', name: 'Grok', url: 'https://grok.com/' },
    { key: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai/' },
    { key: 'aistudio', name: 'AI Studio', url: 'https://aistudio.google.com/prompts/new_chat' },
  ],
};

export function createFallbackRuntime(): SidebarRuntime {
  return {
    async getConfig(): Promise<AppConfig> {
      return fallbackConfig;
    },
    async setPaneCount(_count: PaneCount): Promise<void> {
      // No-op in fallback mode
    },
    async updateProvider(_paneIndex: number, _providerKey: string): Promise<void> {
      // No-op in fallback mode
    },
    async updateSidebarWidth(_width: number): Promise<void> {
      // No-op in fallback mode
    },
    async updateLayout(_args: {
      viewportWidth: number;
      viewportHeight: number;
      paneCount: PaneCount;
      sidebarWidth: number;
    }): Promise<void> {
      // No-op in fallback mode
    },
    async sendPrompt(_text: string): Promise<void> {
      console.log('[Fallback] sendPrompt called, but no runtime available');
    },
  };
}
