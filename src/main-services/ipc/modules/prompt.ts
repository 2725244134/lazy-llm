import { ipcMain } from 'electron';
import type {
  PromptImagePayload,
  PromptRequest,
  PromptSyncRequest,
} from '@shared-contracts/ipc/contracts';
import { IPC_CHANNELS } from '@shared-contracts/ipc/contracts';
import type { IpcRuntimeContext } from '../context.js';

function normalizePromptImage(image: PromptRequest['image']): PromptImagePayload | null {
  if (image === undefined || image === null) {
    return null;
  }

  if (typeof image.mimeType !== 'string' || !image.mimeType.startsWith('image/')) {
    return null;
  }

  if (typeof image.base64Data !== 'string' || image.base64Data.length === 0) {
    return null;
  }

  if (!Number.isFinite(image.sizeBytes) || image.sizeBytes <= 0) {
    return null;
  }

  if (image.source !== 'clipboard') {
    return null;
  }

  return {
    mimeType: image.mimeType,
    base64Data: image.base64Data,
    sizeBytes: image.sizeBytes,
    source: image.source,
  };
}

export function registerPromptIpcHandlers(context: IpcRuntimeContext): void {
  ipcMain.handle(IPC_CHANNELS.PROMPT_SEND, async (_event, request: PromptRequest) => {
    const viewManager = context.getViewManager();
    if (!viewManager) {
      return { success: false, failures: ['no-view-manager'] };
    }

    const normalizedRequest: PromptRequest = {
      text: typeof request?.text === 'string' ? request.text : '',
      image: normalizePromptImage(request?.image),
    };
    return viewManager.sendPromptToAll(normalizedRequest);
  });

  ipcMain.handle(IPC_CHANNELS.PROMPT_SYNC_DRAFT, async (_event, request: PromptSyncRequest) => {
    const viewManager = context.getViewManager();
    if (!viewManager) {
      return { success: false, failures: ['no-view-manager'] };
    }

    const text = typeof request?.text === 'string' ? request.text : '';
    return viewManager.syncPromptDraftToAll(text);
  });
}
