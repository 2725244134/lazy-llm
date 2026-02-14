import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '@shared-contracts/ipc/contracts';
import type {
  PromptRequest,
  PromptResponse,
  PromptSyncResponse,
  QuickPromptHideResponse,
  QuickPromptResizeResponse,
} from '@shared-contracts/ipc/contracts';

const quickPromptAPI = {
  sendPrompt: (request: PromptRequest): Promise<PromptResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PROMPT_SEND, request);
  },
  syncPromptDraft: (text: string): Promise<PromptSyncResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PROMPT_SYNC_DRAFT, { text });
  },
  hide: (): Promise<QuickPromptHideResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.QUICK_PROMPT_HIDE);
  },
  resize: (height: number): Promise<QuickPromptResizeResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.QUICK_PROMPT_RESIZE, { height });
  },
};

contextBridge.exposeInMainWorld('quickPrompt', quickPromptAPI);
