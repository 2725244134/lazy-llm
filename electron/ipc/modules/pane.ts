import { ipcMain } from 'electron';
import type {
  PaneCountRequest,
  PaneUpdateRequest,
  PaneResponseReadyPayload,
} from '../contracts.js';
import { IPC_CHANNELS } from '../contracts.js';
import type { IpcRuntimeContext } from '../context.js';
import { validatePaneCount, validatePaneIndex } from '../validation.js';

export function registerPaneIpcHandlers(context: IpcRuntimeContext): void {
  ipcMain.handle(IPC_CHANNELS.PANE_SET_COUNT, (_event, request: PaneCountRequest) => {
    const viewManager = context.getViewManager();
    if (!viewManager) {
      return { success: false };
    }

    const count = validatePaneCount(request?.count);
    viewManager.setPaneCount(count);
    context.setDefaultPaneCount(count);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.PANE_RESET_ALL, () => {
    const viewManager = context.getViewManager();
    if (!viewManager) {
      return { success: false };
    }

    return {
      success: viewManager.resetAllPanesToProviderHome(),
    };
  });

  ipcMain.handle(IPC_CHANNELS.PANE_UPDATE_PROVIDER, (_event, request: PaneUpdateRequest) => {
    const viewManager = context.getViewManager();
    if (!viewManager) {
      return { success: false, paneIndex: request?.paneIndex ?? -1 };
    }

    const paneIndex = validatePaneIndex(request?.paneIndex, viewManager.getPaneCount() - 1);
    if (paneIndex === null) {
      return { success: false, paneIndex: request?.paneIndex ?? -1 };
    }

    const providerKey = typeof request?.providerKey === 'string' ? request.providerKey : '';
    const success = viewManager.updatePaneProvider(paneIndex, providerKey);
    if (success) {
      context.setDefaultProvider(paneIndex, providerKey);
    }

    return { success, paneIndex };
  });

  ipcMain.on(IPC_CHANNELS.PANE_RESPONSE_READY, (_event, payload: PaneResponseReadyPayload) => {
    const paneIndex = typeof payload?.paneIndex === 'number' ? payload.paneIndex : -1;
    const response = typeof payload?.response === 'string' ? payload.response : '';

    console.log('[IPC] pane:responseReady', {
      paneIndex,
      responseLength: response.length,
    });
  });
}
