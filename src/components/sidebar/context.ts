import type { InjectionKey, Ref } from 'vue';
import { APP_CONFIG } from '@/config';

export const MAX_PANES = APP_CONFIG.layout.pane.maxCount;
export type PaneCount = 1 | 2 | 3 | 4;

export interface SidebarContext {
  paneCount: Ref<PaneCount>;
  activeProviders: Ref<string[]>;
  providerLoadingByPane: Ref<Record<number, boolean>>;
  setPaneCount: (count: number) => Promise<void>;
  newAll: () => Promise<void>;
  setProvider: (paneIndex: number, providerKey: string) => Promise<void>;
  syncPromptDraft: (text: string) => Promise<void>;
  sendPrompt: (text: string) => Promise<void>;
}

export const SIDEBAR_KEY: InjectionKey<SidebarContext> = Symbol('sidebar');
