import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './ipc/contracts.js';
import type { PromptResponse, QuickPromptHideResponse } from './ipc/contracts.js';

const quickPromptAPI = {
  sendPrompt: (text: string): Promise<PromptResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PROMPT_SEND, { text });
  },
  hide: (): Promise<QuickPromptHideResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.QUICK_PROMPT_HIDE);
  },
};

contextBridge.exposeInMainWorld('quickPrompt', quickPromptAPI);

