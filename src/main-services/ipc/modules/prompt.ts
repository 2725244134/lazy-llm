import { ipcMain } from 'electron';
import type {
  PromptAttachImageRequest,
  PromptQueueRemoveItemRequest,
  PromptQueueRemoveRoundRequest,
  PromptRequest,
  PromptSyncRequest,
} from '@shared-contracts/ipc/contracts';
import { IPC_CHANNELS } from '@shared-contracts/ipc/contracts';
import { normalizePromptImagePayload, validatePromptImagePayload } from '@shared-contracts/ipc/promptImage';
import type { IpcRuntimeContext } from '../context.js';

export function registerPromptIpcHandlers(context: IpcRuntimeContext): void {
  ipcMain.handle(IPC_CHANNELS.PROMPT_SEND, async (_event, request: PromptRequest) => {
    const viewManager = context.getViewManager();
    if (!viewManager) {
      return { success: false, failures: ['no-view-manager'] };
    }

    const normalizedRequest: PromptRequest = {
      text: typeof request?.text === 'string' ? request.text : '',
      image: normalizePromptImagePayload(request?.image) ?? undefined,
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

  ipcMain.handle(
    IPC_CHANNELS.PROMPT_ATTACH_IMAGE,
    async (_event, request: PromptAttachImageRequest) => {
      const viewManager = context.getViewManager();
      if (!viewManager) {
        return { success: false, failures: ['no-view-manager'] };
      }

      const normalizedImage = normalizePromptImagePayload(request?.image);
      console.info('[QuickPromptDebug][IPC] PROMPT_ATTACH_IMAGE received', {
        hasImage: normalizedImage !== null,
        imageMimeType: normalizedImage?.mimeType ?? null,
        imageSizeBytes: normalizedImage?.sizeBytes ?? null,
        imageBase64Length: normalizedImage?.base64Data.length ?? null,
      });

      if (!normalizedImage) {
        const validation = validatePromptImagePayload(request?.image);
        return {
          success: false,
          failures: [
            validation.ok
              ? 'invalid-prompt-image: prompt image payload is invalid'
              : `invalid-prompt-image: ${validation.reason}`,
          ],
        };
      }

      return viewManager.attachPromptImageToAll(normalizedImage);
    }
  );

  ipcMain.handle(IPC_CHANNELS.PROMPT_SYNC_DRAFT, async (_event, request: PromptSyncRequest) => {
    const viewManager = context.getViewManager();
    if (!viewManager) {
      return { success: false, failures: ['no-view-manager'] };
    }

    const text = typeof request?.text === 'string' ? request.text : '';
    return viewManager.syncPromptDraftToAll(text);
  });

  ipcMain.handle(
    IPC_CHANNELS.PROMPT_QUEUE_REMOVE_ITEM,
    async (_event, request: PromptQueueRemoveItemRequest) => {
      const viewManager = context.getViewManager();
      if (!viewManager) {
        return {
          success: false,
          removedCount: 0,
          failures: ['no-view-manager'],
        };
      }

      const queueItemId = typeof request?.queueItemId === 'string'
        ? request.queueItemId.trim()
        : '';
      if (!queueItemId) {
        return {
          success: false,
          removedCount: 0,
          failures: ['invalid-queue-item-id'],
        };
      }

      return viewManager.removeQueuedPromptItem(queueItemId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PROMPT_QUEUE_REMOVE_ROUND,
    async (_event, request: PromptQueueRemoveRoundRequest) => {
      const viewManager = context.getViewManager();
      if (!viewManager) {
        return {
          success: false,
          removedCount: 0,
          failures: ['no-view-manager'],
        };
      }

      const roundId = typeof request?.roundId === 'number'
        ? Math.floor(request.roundId)
        : Number.NaN;
      if (!Number.isInteger(roundId) || roundId <= 0) {
        return {
          success: false,
          removedCount: 0,
          failures: ['invalid-round-id'],
        };
      }

      return viewManager.removeQueuedPromptRound(roundId);
    }
  );

  ipcMain.handle(IPC_CHANNELS.PROMPT_QUEUE_CLEAR, async () => {
    const viewManager = context.getViewManager();
    if (!viewManager) {
      return {
        success: false,
        removedCount: 0,
        failures: ['no-view-manager'],
      };
    }

    return viewManager.clearQueuedPrompts();
  });
}
