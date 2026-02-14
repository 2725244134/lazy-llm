import type { SidebarRuntime, PaneCount, AppConfig } from './types';

export function createElectronRuntime(): SidebarRuntime {
  const lazyllm = window.lazyllm;

  if (!lazyllm) {
    throw new Error('Electron bridge (window.lazyllm) is not available');
  }

  return {
    async getConfig(): Promise<AppConfig> {
      return lazyllm.getConfig();
    },

    async setPaneCount(count: PaneCount): Promise<void> {
      const result = await lazyllm.setPaneCount({ count });
      if (!result.success) {
        throw new Error('Failed to set pane count');
      }
    },

    async resetAllPanes(): Promise<void> {
      const result = await lazyllm.resetAllPanes();
      if (!result.success) {
        throw new Error('Failed to reset all panes');
      }
    },

    async updateProvider(paneIndex: number, providerKey: string): Promise<void> {
      const result = await lazyllm.updateProvider({ paneIndex, providerKey });
      if (!result.success) {
        throw new Error(`Failed to update provider for pane ${paneIndex}`);
      }
    },

    async updateSidebarWidth(width: number): Promise<void> {
      const result = await lazyllm.updateSidebarWidth({ width });
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
      const result = await lazyllm.updateLayout({
        sidebarWidth: args.sidebarWidth,
        paneCount: args.paneCount,
      });
      if (!result.success) {
        throw new Error('Failed to update layout');
      }
    },

    async sendPrompt(text: string): Promise<{ queued: boolean }> {
      const result = await lazyllm.sendPrompt({ text });
      if (!result.success) {
        throw new Error(`Failed to send prompt: ${result.failures?.join(', ') ?? 'unknown error'}`);
      }

      return {
        queued: result.queued === true,
      };
    },

    async syncPromptDraft(text: string): Promise<void> {
      const result = await lazyllm.syncPromptDraft({ text });
      if (!result.success) {
        throw new Error(
          `Failed to sync prompt draft: ${result.failures?.join(', ') ?? 'unknown error'}`
        );
      }
    },
  };
}
