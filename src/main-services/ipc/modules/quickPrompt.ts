import { ipcMain } from 'electron';
import type { QuickPromptResizeRequest } from '@shared-contracts/ipc/contracts';
import { IPC_CHANNELS } from '@shared-contracts/ipc/contracts';
import type { IpcRuntimeContext } from '../context.js';

export function registerQuickPromptIpcHandlers(context: IpcRuntimeContext): void {
  ipcMain.handle(IPC_CHANNELS.QUICK_PROMPT_TOGGLE, (event) => {
    const viewManager = context.getViewManager();
    if (!viewManager) {
      return { success: false, visible: false };
    }

    return {
      success: true,
      visible: viewManager.toggleQuickPrompt(event.sender),
    };
  });

  ipcMain.handle(IPC_CHANNELS.QUICK_PROMPT_HIDE, () => {
    const viewManager = context.getViewManager();
    if (!viewManager) {
      return { success: false, visible: false };
    }

    return {
      success: true,
      visible: viewManager.hideQuickPrompt(),
    };
  });

  ipcMain.handle(IPC_CHANNELS.QUICK_PROMPT_RESIZE, (_event, request: QuickPromptResizeRequest) => {
    const viewManager = context.getViewManager();
    if (!viewManager) {
      return { success: false, visible: false, height: 0 };
    }

    const height = typeof request?.height === 'number' ? request.height : 0;
    return {
      success: true,
      ...viewManager.resizeQuickPrompt(height),
    };
  });
}
