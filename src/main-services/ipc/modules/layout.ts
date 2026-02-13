import { ipcMain } from 'electron';
import type { LayoutUpdateRequest, SidebarWidthRequest } from '@shared-contracts/ipc/contracts';
import { IPC_CHANNELS } from '@shared-contracts/ipc/contracts';
import type { IpcRuntimeContext } from '../context.js';
import { validatePaneCount, validateSidebarWidth } from '../validation.js';

export function registerLayoutIpcHandlers(context: IpcRuntimeContext): void {
  ipcMain.handle(IPC_CHANNELS.LAYOUT_UPDATE, (_event, request: LayoutUpdateRequest) => {
    const viewManager = context.getViewManager();
    if (!viewManager) {
      return { success: false };
    }

    const paneCount = validatePaneCount(request?.paneCount);
    const sidebarWidth = validateSidebarWidth(request?.sidebarWidth);

    viewManager.setPaneCount(paneCount);
    viewManager.updateLayout(sidebarWidth);

    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.SIDEBAR_UPDATE_WIDTH, (_event, request: SidebarWidthRequest) => {
    const viewManager = context.getViewManager();
    if (!viewManager) {
      return { success: false };
    }

    const width = validateSidebarWidth(request?.width);
    viewManager.setSidebarWidth(width);
    return { success: true };
  });
}
