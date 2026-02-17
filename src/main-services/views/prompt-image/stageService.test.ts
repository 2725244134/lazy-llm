import type { IpcMainEvent, WebContents } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import type {
  PaneStagePromptImageAckPayload,
  PaneStagePromptImagePayload,
  PromptImagePayload,
} from '@shared-contracts/ipc/contracts';
import { IPC_CHANNELS } from '@shared-contracts/ipc/contracts';
import { PromptImageStageService, type PromptImageStageAckBus } from './stageService';

type AckListener = (event: IpcMainEvent, payload: PaneStagePromptImageAckPayload) => void;

class MockAckBus implements PromptImageStageAckBus {
  private listener: AckListener | null = null;

  on(_channel: string, listener: AckListener): void {
    this.listener = listener;
  }

  off(_channel: string, listener: AckListener): void {
    if (this.listener === listener) {
      this.listener = null;
    }
  }

  emit(payload: PaneStagePromptImageAckPayload): void {
    if (!this.listener) {
      return;
    }
    this.listener({} as IpcMainEvent, payload);
  }

  hasListener(): boolean {
    return this.listener !== null;
  }
}

function createPromptImagePayload(): PromptImagePayload {
  return {
    mimeType: 'image/png',
    base64Data: 'QUJD',
    sizeBytes: 3,
    source: 'clipboard',
  };
}

function createMockWebContents(
  sendImpl?: (channel: string, payload: PaneStagePromptImagePayload) => void,
): {
  webContents: WebContents;
  send: ReturnType<typeof vi.fn<(channel: string, payload: PaneStagePromptImagePayload) => void>>;
  setDestroyed(next: boolean): void;
} {
  let destroyed = false;
  const send = vi.fn<(channel: string, payload: PaneStagePromptImagePayload) => void>((channel, payload) => {
    sendImpl?.(channel, payload);
  });
  const webContents = {
    isDestroyed: () => destroyed,
    send,
  } as unknown as WebContents;

  return {
    webContents,
    send,
    setDestroyed(next: boolean): void {
      destroyed = next;
    },
  };
}

describe('PromptImageStageService', () => {
  it('stages prompt image payload and resolves consume token after success ack', async () => {
    const ackBus = new MockAckBus();
    const service = new PromptImageStageService({
      ackBus,
      timeoutMs: 2_000,
      now: () => 1234,
      createConsumeToken: () => 'consume-token-1',
    });
    const pane = createMockWebContents();
    const image = createPromptImagePayload();

    const promise = service.stagePromptImagePayload(pane.webContents, 3, image);

    expect(pane.send).toHaveBeenCalledTimes(1);
    expect(pane.send).toHaveBeenCalledWith(
      IPC_CHANNELS.PANE_STAGE_PROMPT_IMAGE,
      {
        requestId: '3:1234:0',
        consumeToken: 'consume-token-1',
        image,
      },
    );

    ackBus.emit({
      requestId: '3:1234:0',
      paneIndex: 3,
      success: true,
    });

    await expect(promise).resolves.toBe('consume-token-1');
    service.destroy('test done');
  });

  it('rejects when ack pane index mismatches pending pane index', async () => {
    const ackBus = new MockAckBus();
    const service = new PromptImageStageService({
      ackBus,
      timeoutMs: 2_000,
      now: () => 5678,
      createConsumeToken: () => 'consume-token-2',
    });
    const pane = createMockWebContents();
    const image = createPromptImagePayload();

    const promise = service.stagePromptImagePayload(pane.webContents, 1, image);
    ackBus.emit({
      requestId: '1:5678:0',
      paneIndex: 2,
      success: true,
    });

    await expect(promise).rejects.toThrow('expected 1, got 2');
    service.destroy('test done');
  });

  it('rejects when staging response times out', async () => {
    vi.useFakeTimers();

    const ackBus = new MockAckBus();
    const service = new PromptImageStageService({
      ackBus,
      timeoutMs: 50,
      now: () => 7890,
      createConsumeToken: () => 'consume-token-3',
    });
    const pane = createMockWebContents();
    const promise = service.stagePromptImagePayload(
      pane.webContents,
      0,
      createPromptImagePayload(),
    );
    const expectation = expect(promise).rejects.toThrow('timed out while staging prompt image payload');

    await vi.advanceTimersByTimeAsync(50);
    await expectation;
    service.destroy('test done');

    vi.useRealTimers();
  });

  it('rejects pending requests and detaches ack listener on destroy', async () => {
    const ackBus = new MockAckBus();
    const service = new PromptImageStageService({
      ackBus,
      timeoutMs: 2_000,
      now: () => 9012,
      createConsumeToken: () => 'consume-token-4',
    });
    const pane = createMockWebContents();
    const promise = service.stagePromptImagePayload(
      pane.webContents,
      4,
      createPromptImagePayload(),
    );

    expect(ackBus.hasListener()).toBe(true);
    service.destroy('service destroyed');
    expect(ackBus.hasListener()).toBe(false);

    await expect(promise).rejects.toThrow('service destroyed');
  });

  it('fails fast when pane webContents is destroyed', async () => {
    const ackBus = new MockAckBus();
    const service = new PromptImageStageService({
      ackBus,
      timeoutMs: 2_000,
    });
    const pane = createMockWebContents();
    pane.setDestroyed(true);

    await expect(
      service.stagePromptImagePayload(pane.webContents, 0, createPromptImagePayload()),
    ).rejects.toThrow('pane webContents is destroyed');

    service.destroy('test done');
  });
});
