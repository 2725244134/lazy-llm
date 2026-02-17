import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '@shared-contracts/ipc/contracts';
import type {
  HealthResponse,
  AppConfig,
  PaneCountRequest,
  PaneCountResponse,
  PaneResetAllResponse,
  PaneUpdateRequest,
  PaneUpdateResponse,
  PromptRequest,
  PromptResponse,
  PromptQueueMutationResponse,
  PromptQueueRemoveItemRequest,
  PromptQueueRemoveRoundRequest,
  PromptSyncRequest,
  PromptSyncResponse,
  LayoutUpdateRequest,
  LayoutUpdateResponse,
  SidebarWidthRequest,
  SidebarWidthResponse,
  QuickPromptToggleResponse,
  QuickPromptHideResponse,
  QuickPromptResizeRequest,
  QuickPromptResizeResponse,
} from '@shared-contracts/ipc/contracts';

// Type-safe API exposed to renderer
const lazyllmAPI = {
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

  // Reset all panes to each provider home page
  resetAllPanes: (): Promise<PaneResetAllResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PANE_RESET_ALL);
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

  // Remove one queued prompt item by queueItemId
  removeQueuedPromptItem: (
    request: PromptQueueRemoveItemRequest
  ): Promise<PromptQueueMutationResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PROMPT_QUEUE_REMOVE_ITEM, request);
  },

  // Remove all queued prompt items from a specific dispatch round
  removeQueuedPromptRound: (
    request: PromptQueueRemoveRoundRequest
  ): Promise<PromptQueueMutationResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PROMPT_QUEUE_REMOVE_ROUND, request);
  },

  // Clear all queued prompt items
  clearQueuedPrompts: (): Promise<PromptQueueMutationResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PROMPT_QUEUE_CLEAR);
  },

  // Update layout
  updateLayout: (request: LayoutUpdateRequest): Promise<LayoutUpdateResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.LAYOUT_UPDATE, request);
  },

  // Update sidebar width
  updateSidebarWidth: (request: SidebarWidthRequest): Promise<SidebarWidthResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SIDEBAR_UPDATE_WIDTH, request);
  },

  // Toggle quick prompt overlay
  toggleQuickPrompt: (): Promise<QuickPromptToggleResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.QUICK_PROMPT_TOGGLE);
  },

  // Hide quick prompt overlay
  hideQuickPrompt: (): Promise<QuickPromptHideResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.QUICK_PROMPT_HIDE);
  },

  // Resize quick prompt overlay height
  resizeQuickPrompt: (request: QuickPromptResizeRequest): Promise<QuickPromptResizeResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.QUICK_PROMPT_RESIZE, request);
  },
};

// Expose API to renderer via contextBridge
contextBridge.exposeInMainWorld('lazyllm', lazyllmAPI);

// Export type for use in renderer
export type LazyLLMAPI = typeof lazyllmAPI;
