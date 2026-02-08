import type { AppConfig, PaneCount, SidebarRuntime } from './types';
import { APP_CONFIG } from '@/config';

const fallbackConfig: AppConfig = {
  sidebar: {
    expanded_width: APP_CONFIG.layout.sidebar.defaultExpandedWidth,
    collapsed_width: APP_CONFIG.layout.sidebar.defaultCollapsedWidth,
  },
  defaults: {
    pane_count: APP_CONFIG.layout.pane.defaultCount,
    providers: [...APP_CONFIG.providers.defaultPaneKeys],
  },
  providers: APP_CONFIG.providers.catalog.map((provider) => ({ ...provider })),
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
    async syncPromptDraft(_text: string): Promise<void> {
      // No-op in fallback mode
    },
  };
}
