import { ipcMain } from 'electron';
import type {
  PromptRequest,
  PromptSyncRequest,
} from '@shared-contracts/ipc/contracts';
import { IPC_CHANNELS } from '@shared-contracts/ipc/contracts';
import { normalizePromptImagePayload } from '@shared-contracts/ipc/promptImage';
import type { IpcRuntimeContext } from '../context.js';

export function registerPromptIpcHandlers(context: IpcRuntimeContext): void {
  ipcMain.handle(IPC_CHANNELS.PROMPT_SEND, async (_event, request: PromptRequest) => {
    const viewManager = context.getViewManager();
    if (!viewManager) {
      return { success: false, failures: ['no-view-manager'] };
    }

    const normalizedRequest: PromptRequest = {
      text: typeof request?.text === 'string' ? request.text : '',
      image: normalizePromptImagePayload(request?.image),
    };
    console.info('[QuickPromptDebug][IPC] PROMPT_SEND received', {
      textLength: normalizedRequest.text.length,
      hasImage: normalizedRequest.image !== null,
      imageMimeType: normalizedRequest.image?.mimeType ?? null,
      imageSizeBytes: normalizedRequest.image?.sizeBytes ?? null,
      imageBase64Length: normalizedRequest.image?.base64Data.length ?? null,
    });
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
