import { app, ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared-contracts/ipc/contracts';

export function registerAppIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.APP_HEALTH, () => {
    return {
      ok: true,
      runtime: 'electron' as const,
      version: app.getVersion(),
    };
  });
}
