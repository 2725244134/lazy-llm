import type { AppConfig } from '../../../electron/ipc/contracts';

export type PaneCount = 1 | 2 | 3 | 4;

export interface SidebarRuntime {
  getConfig(): Promise<AppConfig>;
  setPaneCount(count: PaneCount): Promise<void>;
  updateProvider(paneIndex: number, providerKey: string, totalPanes: PaneCount): Promise<void>;
  updateLayout(args: {
    viewportWidth: number;
    viewportHeight: number;
    paneCount: PaneCount;
    sidebarWidth: number;
  }): Promise<void>;
  sendPrompt(text: string): Promise<void>;
}

export type { AppConfig };
