import type { SidebarRuntime, PaneCount, AppConfig } from './types';
import { createElectronRuntime } from './electronRuntime';
import { createFallbackRuntime } from './fallbackRuntime';

export type { SidebarRuntime, PaneCount, AppConfig };

let runtimeInstance: SidebarRuntime | null = null;

export function getSidebarRuntime(): SidebarRuntime {
  if (runtimeInstance) {
    return runtimeInstance;
  }

  if (typeof window !== 'undefined' && window.council) {
    runtimeInstance = createElectronRuntime();
  } else {
    runtimeInstance = createFallbackRuntime();
  }

  return runtimeInstance;
}
