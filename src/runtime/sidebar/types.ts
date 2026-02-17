import type { AppConfig } from '@shared-contracts/ipc/contracts';

export type PaneCount = 1 | 2 | 3 | 4;

export interface SidebarRuntime {
  getConfig(): Promise<AppConfig>;
  activateTab(tabId: string, paneCount: PaneCount, paneProviders: readonly string[]): Promise<void>;
  closeTab(tabId: string): Promise<void>;
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
  removeQueuedPromptItem(queueItemId: string): Promise<number>;
  removeQueuedPromptRound(roundId: number): Promise<number>;
  clearQueuedPrompts(): Promise<number>;
}

export type { AppConfig };
