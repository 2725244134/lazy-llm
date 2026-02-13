import type { IpcRuntimeContext } from './context.js';
import { registerAppIpcHandlers } from './modules/app.js';
import { registerConfigIpcHandlers } from './modules/config.js';
import { registerPaneIpcHandlers } from './modules/pane.js';
import { registerPromptIpcHandlers } from './modules/prompt.js';
import { registerLayoutIpcHandlers } from './modules/layout.js';
import { registerQuickPromptIpcHandlers } from './modules/quickPrompt.js';

export function registerIpcHandlers(context: IpcRuntimeContext): void {
  registerAppIpcHandlers();
  registerConfigIpcHandlers(context);
  registerPaneIpcHandlers(context);
  registerPromptIpcHandlers(context);
  registerLayoutIpcHandlers(context);
  registerQuickPromptIpcHandlers(context);
}
