import { createContext, createElement, useContext } from 'react';
import { APP_CONFIG } from '@/config';

export const MAX_PANES = APP_CONFIG.layout.pane.maxCount;
export type PaneCount = 1 | 2 | 3 | 4;

export interface SidebarContextValue {
  paneCount: PaneCount;
  activeProviders: string[];
  providerLoadingByPane: Record<number, boolean>;
  setPaneCount: (count: number) => Promise<void>;
  newAll: () => Promise<void>;
  setProvider: (paneIndex: number, providerKey: string) => Promise<void>;
  syncPromptDraft: (text: string) => Promise<void>;
  sendPrompt: (text: string) => Promise<void>;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarContextProvider(props: {
  value: SidebarContextValue;
  children: React.ReactNode;
}) {
  return createElement(SidebarContext.Provider, { value: props.value }, props.children);
}

export function useSidebarContext(): SidebarContextValue {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('Sidebar context is not available');
  }
  return context;
}
