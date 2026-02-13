import type { ViewManager } from '../views/manager.js';
import type { AppConfig } from './contracts.js';

export interface IpcRuntimeContext {
  getViewManager: () => ViewManager | null;
  getConfig: () => AppConfig;
  setDefaultPaneCount: (paneCount: number) => void;
  setDefaultProvider: (paneIndex: number, providerKey: string) => void;
}
