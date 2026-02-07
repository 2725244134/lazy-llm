import type { InjectionKey, Ref } from 'vue';

export const MAX_PANES = 4 as const;
export type PaneCount = 1 | 2 | 3 | 4;

export interface SidebarContext {
  paneCount: Ref<PaneCount>;
  activeProviders: Ref<string[]>;
  setPaneCount: (count: number) => Promise<void>;
  setProvider: (paneIndex: number, providerKey: string) => Promise<void>;
  sendPrompt: (text: string) => Promise<void>;
}

export const SIDEBAR_KEY: InjectionKey<SidebarContext> = Symbol('sidebar');
