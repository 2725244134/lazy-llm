import { clipboard, contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '@shared-contracts/ipc/contracts';
import type {
  PromptImagePayload,
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
  readClipboardImage: (): PromptImagePayload | null => {
    const image = clipboard.readImage();
    if (image.isEmpty()) {
      return null;
    }

    const bytes = image.toPNG();
    if (!bytes || bytes.byteLength <= 0) {
      return null;
    }

    return {
      mimeType: 'image/png',
      base64Data: bytes.toString('base64'),
      sizeBytes: bytes.byteLength,
      source: 'clipboard',
    };
  },
};

contextBridge.exposeInMainWorld('quickPrompt', quickPromptAPI);
