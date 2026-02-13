import type { AppConfig } from '@shared-contracts/ipc/contracts';

export type PaneCount = 1 | 2 | 3 | 4;

export interface SidebarRuntime {
  getConfig(): Promise<AppConfig>;
  setPaneCount(count: PaneCount): Promise<void>;
  resetAllPanes(): Promise<void>;
  updateProvider(paneIndex: number, providerKey: string): Promise<void>;
  updateSidebarWidth(width: number): Promise<void>;
  updateLayout(args: {
    viewportWidth: number;
    viewportHeight: number;
    paneCount: PaneCount;
    sidebarWidth: number;
  }): Promise<void>;
  syncPromptDraft(text: string): Promise<void>;
  sendPrompt(text: string): Promise<void>;
}

export type { AppConfig };
