import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '@shared-contracts/ipc/contracts';
import type {
  PromptResponse,
  PromptSyncResponse,
  QuickPromptHideResponse,
  QuickPromptResizeResponse,
} from '@shared-contracts/ipc/contracts';

const quickPromptAPI = {
  sendPrompt: (text: string): Promise<PromptResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PROMPT_SEND, { text });
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
