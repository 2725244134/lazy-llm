import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared-contracts/ipc/contracts';
import type { IpcRuntimeContext } from '../context.js';

export function registerConfigIpcHandlers(context: IpcRuntimeContext): void {
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, () => {
    return context.getConfig();
  });
}
