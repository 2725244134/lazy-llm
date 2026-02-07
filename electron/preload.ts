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
  PromptSyncRequest,
  PromptSyncResponse,
  LayoutUpdateRequest,
  LayoutUpdateResponse,
  SidebarWidthRequest,
  SidebarWidthResponse,
  LayoutSnapshot,
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

  // Sync prompt draft to all panes without submitting
  syncPromptDraft: (request: PromptSyncRequest): Promise<PromptSyncResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PROMPT_SYNC_DRAFT, request);
  },

  // Update layout
  updateLayout: (request: LayoutUpdateRequest): Promise<LayoutUpdateResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.LAYOUT_UPDATE, request);
  },

  // Get layout snapshot (for testing/debugging)
  getLayoutSnapshot: (): Promise<LayoutSnapshot> => {
    return ipcRenderer.invoke(IPC_CHANNELS.LAYOUT_GET_SNAPSHOT);
  },

  // Update sidebar width
  updateSidebarWidth: (request: SidebarWidthRequest): Promise<SidebarWidthResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SIDEBAR_UPDATE_WIDTH, request);
  },
};

// Expose API to renderer via contextBridge
contextBridge.exposeInMainWorld('council', councilAPI);

// Export type for use in renderer
export type CouncilAPI = typeof councilAPI;
