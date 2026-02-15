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

const QUICK_PROMPT_DEBUG_PREFIX = '[QuickPromptDebug][Preload]';

function logQuickPromptDebug(message: string, details?: Record<string, unknown>): void {
  if (details === undefined) {
    console.info(`${QUICK_PROMPT_DEBUG_PREFIX} ${message}`);
    return;
  }
  console.info(`${QUICK_PROMPT_DEBUG_PREFIX} ${message} ${stringifyDebugDetails(details)}`);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === 'string') {
    return error.message;
  }
  return String(error);
}

function stringifyDebugDetails(details: Record<string, unknown>): string {
  try {
    return JSON.stringify(details);
  } catch (_error) {
    return String(details);
  }
}

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
    logQuickPromptDebug('readClipboardImage invoked');
    try {
      const image = clipboard.readImage();
      if (image.isEmpty()) {
        logQuickPromptDebug('clipboard.readImage returned empty image');
        return null;
      }

      const bytes = image.toPNG();
      if (!bytes || bytes.byteLength <= 0) {
        logQuickPromptDebug('clipboard image converted to empty PNG payload');
        return null;
      }

      logQuickPromptDebug('clipboard image payload generated', {
        mimeType: 'image/png',
        sizeBytes: bytes.byteLength,
      });

      return {
        mimeType: 'image/png',
        base64Data: bytes.toString('base64'),
        sizeBytes: bytes.byteLength,
        source: 'clipboard',
      };
    } catch (error) {
      logQuickPromptDebug('readClipboardImage failed', {
        error: toErrorMessage(error),
      });
      return null;
    }
  },
};

contextBridge.exposeInMainWorld('quickPrompt', quickPromptAPI);
