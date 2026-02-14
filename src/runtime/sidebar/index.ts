import type { SidebarRuntime, PaneCount, AppConfig } from './types';
import { createElectronRuntime } from './electronRuntime';

export type { SidebarRuntime, PaneCount, AppConfig };

let runtimeInstance: SidebarRuntime | null = null;

export function getSidebarRuntime(): SidebarRuntime {
  if (runtimeInstance) {
    return runtimeInstance;
  }

  runtimeInstance = createElectronRuntime();

  return runtimeInstance;
}
