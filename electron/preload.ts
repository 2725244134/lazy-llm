import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './ipc/contracts.js';
import type {
  HealthResponse,
  AppConfig,
  PaneCountRequest,
  PaneCountResponse,
  PaneUpdateRequest,
  PaneUpdateResponse,
  PromptRequest,
  PromptResponse,
} from './ipc/contracts.js';

// Type-safe API exposed to renderer
const councilAPI = {
  // Health check
  healthCheck: (): Promise<HealthResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.APP_HEALTH);
  },

  // Get app config
  getConfig: (): Promise<AppConfig> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET);
  },

  // Set pane count
  setPaneCount: (request: PaneCountRequest): Promise<PaneCountResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PANE_SET_COUNT, request);
  },

  // Update provider for a pane
  updateProvider: (request: PaneUpdateRequest): Promise<PaneUpdateResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PANE_UPDATE_PROVIDER, request);
  },

  // Send prompt to all panes
  sendPrompt: (request: PromptRequest): Promise<PromptResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PROMPT_SEND, request);
  },
};

// Expose API to renderer via contextBridge
contextBridge.exposeInMainWorld('council', councilAPI);

// Export type for use in renderer
export type CouncilAPI = typeof councilAPI;
