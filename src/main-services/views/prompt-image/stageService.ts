import { randomUUID } from 'node:crypto';
import type { IpcMainEvent, WebContents } from 'electron';
import type {
  PaneStagePromptImageAckPayload,
  PaneStagePromptImagePayload,
  PromptImagePayload,
} from '@shared-contracts/ipc/contracts';
import { IPC_CHANNELS } from '@shared-contracts/ipc/contracts';

export interface PromptImageStageAckBus {
  on(
    channel: string,
    listener: (event: IpcMainEvent, payload: PaneStagePromptImageAckPayload) => void,
  ): unknown;
  off(
    channel: string,
    listener: (event: IpcMainEvent, payload: PaneStagePromptImageAckPayload) => void,
  ): unknown;
}

interface PendingPromptImageStageRequest {
  paneIndex: number;
  consumeToken: string;
  timer: ReturnType<typeof setTimeout>;
  resolve: (consumeToken: string) => void;
  reject: (error: Error) => void;
}

export interface PromptImageStageServiceOptions {
  ackBus: PromptImageStageAckBus;
  timeoutMs: number;
  now?: () => number;
  createConsumeToken?: () => string;
}

export class PromptImageStageService {
  private requestSeq = 0;
  private readonly pendingRequests = new Map<string, PendingPromptImageStageRequest>();

  constructor(private readonly options: PromptImageStageServiceOptions) {
    this.options.ackBus.on(
      IPC_CHANNELS.PANE_STAGE_PROMPT_IMAGE_ACK,
      this.handleStagePromptImageAck,
    );
  }

  stagePromptImagePayload(
    paneWebContents: WebContents,
    paneIndex: number,
    image: PromptImagePayload,
  ): Promise<string> {
    if (paneWebContents.isDestroyed()) {
      return Promise.reject(new Error('pane webContents is destroyed'));
    }

    const now = this.options.now ? this.options.now() : Date.now();
    const requestId = `${paneIndex}:${now}:${this.requestSeq++}`;
    const consumeToken = this.options.createConsumeToken
      ? this.options.createConsumeToken()
      : randomUUID();
    const stagePayload: PaneStagePromptImagePayload = {
      requestId,
      consumeToken,
      image,
    };

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('timed out while staging prompt image payload'));
      }, this.options.timeoutMs);

      const rejectWithError = (error: unknown): void => {
        clearTimeout(timer);
        this.pendingRequests.delete(requestId);
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      this.pendingRequests.set(requestId, {
        paneIndex,
        consumeToken,
        timer,
        resolve,
        reject: (error) => rejectWithError(error),
      });

      try {
        paneWebContents.send(IPC_CHANNELS.PANE_STAGE_PROMPT_IMAGE, stagePayload);
      } catch (error) {
        rejectWithError(error);
      }
    });
  }

  destroy(reason: string): void {
    this.options.ackBus.off(
      IPC_CHANNELS.PANE_STAGE_PROMPT_IMAGE_ACK,
      this.handleStagePromptImageAck,
    );
    this.rejectPendingRequests(reason);
  }

  private rejectPendingRequests(reason: string): void {
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
      this.pendingRequests.delete(requestId);
    }
  }

  private readonly handleStagePromptImageAck = (
    _event: IpcMainEvent,
    payload: PaneStagePromptImageAckPayload,
  ): void => {
    const requestId = typeof payload?.requestId === 'string' ? payload.requestId : '';
    if (!requestId) {
      return;
    }

    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      return;
    }

    this.pendingRequests.delete(requestId);
    clearTimeout(pending.timer);

    const responsePaneIndex = typeof payload?.paneIndex === 'number'
      ? payload.paneIndex
      : pending.paneIndex;
    if (responsePaneIndex !== pending.paneIndex) {
      pending.reject(new Error(
        `prompt image stage ack pane mismatch: expected ${pending.paneIndex}, got ${responsePaneIndex}`,
      ));
      return;
    }

    if (payload.success === true) {
      pending.resolve(pending.consumeToken);
      return;
    }

    pending.reject(new Error(
      typeof payload.reason === 'string' && payload.reason
        ? payload.reason
        : 'failed to stage prompt image payload',
    ));
  };
}
