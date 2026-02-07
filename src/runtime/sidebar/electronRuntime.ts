import type { SidebarRuntime, PaneCount, AppConfig } from './types';

export function createElectronRuntime(): SidebarRuntime {
  const council = window.council;

  if (!council) {
    throw new Error('Electron bridge (window.council) is not available');
  }

  return {
    async getConfig(): Promise<AppConfig> {
      return council.getConfig();
    },

    async setPaneCount(count: PaneCount): Promise<void> {
      const result = await council.setPaneCount({ count });
      if (!result.success) {
        throw new Error('Failed to set pane count');
      }
    },

    async updateProvider(paneIndex: number, providerKey: string): Promise<void> {
      const result = await council.updateProvider({ paneIndex, providerKey });
      if (!result.success) {
        throw new Error(`Failed to update provider for pane ${paneIndex}`);
      }
    },

    async updateSidebarWidth(width: number): Promise<void> {
      const result = await council.updateSidebarWidth({ width });
      if (!result.success) {
        throw new Error('Failed to update sidebar width');
      }
    },

    async updateLayout(args: {
      viewportWidth: number;
      viewportHeight: number;
      paneCount: PaneCount;
      sidebarWidth: number;
    }): Promise<void> {
      const result = await council.updateLayout({
        sidebarWidth: args.sidebarWidth,
        paneCount: args.paneCount,
      });
      if (!result.success) {
        throw new Error('Failed to update layout');
      }
    },

    async sendPrompt(text: string): Promise<void> {
      const result = await council.sendPrompt({ text });
      if (!result.success) {
        throw new Error(`Failed to send prompt: ${result.failures?.join(', ') ?? 'unknown error'}`);
      }
    },
  };
}
