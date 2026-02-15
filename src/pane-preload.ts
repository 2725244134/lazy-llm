/**
 * Preload script for pane WebContentsViews
 * Exposes paneAPI for prompt injection and response reporting
 */

import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  type PaneStagePromptImageAckPayload,
  type PaneStagePromptImagePayload,
  type PromptImagePayload,
} from '@shared-contracts/ipc/contracts';
import { normalizePromptImagePayload } from '@shared-contracts/ipc/promptImage';

// Get pane index from additionalArguments (injected by main process via webPreferences)
function getPaneIndex(): number {
  // additionalArguments are passed as --pane-index=N
  const args = (process as NodeJS.Process & { argv: string[] }).argv;
  for (const arg of args) {
    if (arg.startsWith('--pane-index=')) {
      return parseInt(arg.split('=')[1], 10);
    }
  }
  return 0;
}

const paneIndex = getPaneIndex();
let stagedPromptImage: PromptImagePayload | null = null;

function sendPromptImageStageAck(payload: PaneStagePromptImageAckPayload): void {
  ipcRenderer.send(IPC_CHANNELS.PANE_STAGE_PROMPT_IMAGE_ACK, payload);
}

ipcRenderer.on(
  IPC_CHANNELS.PANE_STAGE_PROMPT_IMAGE,
  (_event, payload: PaneStagePromptImagePayload) => {
    const requestId = typeof payload?.requestId === 'string' ? payload.requestId : '';
    if (!requestId) {
      return;
    }

    const normalizedImage = normalizePromptImagePayload(payload?.image);
    if (!normalizedImage) {
      sendPromptImageStageAck({
        requestId,
        paneIndex,
        success: false,
        reason: 'invalid prompt image payload',
      });
      return;
    }

    stagedPromptImage = normalizedImage;
    sendPromptImageStageAck({
      requestId,
      paneIndex,
      success: true,
    });
  }
);

const paneAPI = {
  /**
   * Get the pane index
   */
  getPaneIndex: (): number => paneIndex,

  /**
   * Register callback for prompt injection from main process
   */
  onInjectPrompt: (callback: (text: string) => void): void => {
    ipcRenderer.on(IPC_CHANNELS.PANE_INJECT_PROMPT, (_event, payload: { text: string }) => {
      callback(payload.text);
    });
  },

  /**
   * Report response completion to main process
   */
  reportResponse: (response: string): void => {
    ipcRenderer.send(IPC_CHANNELS.PANE_RESPONSE_READY, {
      paneIndex,
      response,
    });
  },

  consumeStagedPromptImage: (): PromptImagePayload | null => {
    if (!stagedPromptImage) {
      return null;
    }
    const image = stagedPromptImage;
    stagedPromptImage = null;
    return image;
  },
};

// Expose API to renderer
contextBridge.exposeInMainWorld('paneAPI', paneAPI);

// Export type for use in renderer
export type PaneAPI = typeof paneAPI;
