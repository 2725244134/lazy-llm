import { describe, expect, it, vi } from 'vitest';
import type { PromptImagePayload } from '@shared-contracts/ipc/contracts';
import {
  PromptDispatchService,
  type PromptDispatchPaneExecutionTarget,
} from './promptDispatchService';

type ExecuteJavaScriptFn = (script: string, userGesture?: boolean) => Promise<unknown>;
type StagePromptImagePayloadFn = (image: PromptImagePayload) => Promise<string>;

function createPaneTarget(
  paneIndex: number,
  executeImpl: ExecuteJavaScriptFn,
  stageImageImpl: StagePromptImagePayloadFn = async () => 'consume-token'
): {
  target: PromptDispatchPaneExecutionTarget;
  executeJavaScript: ReturnType<typeof vi.fn<ExecuteJavaScriptFn>>;
  stagePromptImagePayload: ReturnType<typeof vi.fn<StagePromptImagePayloadFn>>;
} {
  const executeJavaScript = vi.fn<ExecuteJavaScriptFn>(executeImpl);
  const stagePromptImagePayload = vi.fn<StagePromptImagePayloadFn>(stageImageImpl);
  return {
    target: {
      paneIndex,
      executeJavaScript,
      stagePromptImagePayload,
    },
    executeJavaScript,
    stagePromptImagePayload,
  };
}

describe('PromptDispatchService', () => {
  it('returns invalid prompt failure when prompt text is empty', async () => {
    const pane = createPaneTarget(0, async () => ({ success: true }));
    const service = new PromptDispatchService({
      getPaneTargets: () => [pane.target],
      getInjectRuntimeScript: () => 'inject-runtime-script',
    });

    const result = await service.sendPromptToAll('   ');

    expect(result.success).toBe(false);
    expect(result.failures).toEqual(['invalid-prompt: prompt text cannot be empty']);
    expect(pane.executeJavaScript).not.toHaveBeenCalled();
  });

  it('returns per-pane failures when inject runtime script is unavailable', async () => {
    const pane0 = createPaneTarget(0, async () => ({ success: true }));
    const pane3 = createPaneTarget(3, async () => ({ success: true }));
    const service = new PromptDispatchService({
      getPaneTargets: () => [pane0.target, pane3.target],
      getInjectRuntimeScript: () => null,
    });

    const result = await service.executePromptEvalScriptOnAllPanes('prompt-eval-script');

    expect(result).toEqual({
      success: false,
      failures: [
        'pane-0: inject runtime not available',
        'pane-3: inject runtime not available',
      ],
    });
    expect(pane0.executeJavaScript).not.toHaveBeenCalled();
    expect(pane3.executeJavaScript).not.toHaveBeenCalled();
  });

  it('returns per-pane failures when sendPromptToAll cannot load inject runtime', async () => {
    const pane0 = createPaneTarget(0, async () => ({ success: true }));
    const pane1 = createPaneTarget(1, async () => ({ success: true }));
    const service = new PromptDispatchService({
      getPaneTargets: () => [pane0.target, pane1.target],
      getInjectRuntimeScript: () => null,
    });

    const result = await service.sendPromptToAll('hello');

    expect(result).toEqual({
      success: false,
      failures: [
        'pane-0: inject runtime not available',
        'pane-1: inject runtime not available',
      ],
    });
    expect(pane0.executeJavaScript).not.toHaveBeenCalled();
    expect(pane1.executeJavaScript).not.toHaveBeenCalled();
  });

  it('dispatches immediately when all panes are idle', async () => {
    const injectRuntimeScript = 'inject-runtime-script';
    const promptScripts: string[] = [];

    const pane = createPaneTarget(0, async (script) => {
      if (script === injectRuntimeScript) {
        return undefined;
      }

      if (script.includes('bridge.getStatus')) {
        return {
          success: true,
          provider: 'chatgpt',
          isStreaming: false,
          isComplete: true,
          hasResponse: true,
        };
      }

      if (script.includes('bridge.injectPrompt')) {
        promptScripts.push(script);
        return { success: true };
      }

      return undefined;
    });

    const service = new PromptDispatchService({
      getPaneTargets: () => [pane.target],
      getInjectRuntimeScript: () => injectRuntimeScript,
      queuePollIntervalMs: 10,
      queueIdleConfirmations: 2,
    });

    const result = await service.sendPromptToAll('hello');

    expect(result).toEqual({
      success: true,
      failures: [],
    });
    expect(promptScripts).toHaveLength(1);
    expect(promptScripts[0]).toContain(JSON.stringify('hello'));
  });

  it('treats non-streaming incomplete status as idle to avoid first-message deadlock', async () => {
    const injectRuntimeScript = 'inject-runtime-script';
    const promptScripts: string[] = [];

    const pane = createPaneTarget(0, async (script) => {
      if (script === injectRuntimeScript) {
        return undefined;
      }

      if (script.includes('bridge.getStatus')) {
        return {
          success: true,
          provider: 'chatgpt',
          isStreaming: false,
          isComplete: false,
          hasResponse: false,
        };
      }

      if (script.includes('bridge.injectPrompt')) {
        promptScripts.push(script);
        return { success: true };
      }

      return undefined;
    });

    const service = new PromptDispatchService({
      getPaneTargets: () => [pane.target],
      getInjectRuntimeScript: () => injectRuntimeScript,
      queuePollIntervalMs: 10,
      queueIdleConfirmations: 2,
    });

    const result = await service.sendPromptToAll('first-message');

    expect(result).toEqual({
      success: true,
      failures: [],
    });
    expect(promptScripts).toHaveLength(1);
    expect(promptScripts[0]).toContain(JSON.stringify('first-message'));
  });

  it('treats submit-ready status as idle when response exists but completion marker is stale', async () => {
    const injectRuntimeScript = 'inject-runtime-script';
    const promptScripts: string[] = [];

    const pane = createPaneTarget(0, async (script) => {
      if (script === injectRuntimeScript) {
        return undefined;
      }

      if (script.includes('bridge.getStatus')) {
        return {
          success: true,
          provider: 'gemini',
          isStreaming: false,
          isComplete: false,
          hasResponse: true,
          canSubmit: true,
        };
      }

      if (script.includes('bridge.injectPrompt')) {
        promptScripts.push(script);
        return { success: true };
      }

      return undefined;
    });

    const service = new PromptDispatchService({
      getPaneTargets: () => [pane.target],
      getInjectRuntimeScript: () => injectRuntimeScript,
      queuePollIntervalMs: 10,
      queueIdleConfirmations: 2,
    });

    const result = await service.sendPromptToAll('second-gemini-message');

    expect(result).toEqual({
      success: true,
      failures: [],
    });
    expect(promptScripts).toHaveLength(1);
    expect(promptScripts[0]).toContain(JSON.stringify('second-gemini-message'));
  });

  it('records image attach failure but still submits text prompt', async () => {
    const injectRuntimeScript = 'inject-runtime-script';
    const executedScripts: string[] = [];
    const imagePayload: PromptImagePayload = {
      mimeType: 'image/png',
      base64Data: 'QUJD',
      sizeBytes: 3,
      source: 'clipboard',
    };

    const pane = createPaneTarget(0, async (script) => {
      if (script === injectRuntimeScript) {
        return undefined;
      }

      if (script.includes('bridge.getStatus')) {
        return {
          success: true,
          provider: 'chatgpt',
          isStreaming: false,
          isComplete: true,
          hasResponse: true,
        };
      }

      executedScripts.push(script);

      if (script.includes('attachImageFromClipboard')) {
        return { success: false, reason: 'paste ignored by page' };
      }

      if (script.includes('clickSubmitButton')) {
        return { success: true };
      }

      if (script.includes('bridge.injectPrompt')) {
        return { success: true };
      }

      return undefined;
    });

    const service = new PromptDispatchService({
      getPaneTargets: () => [pane.target],
      getInjectRuntimeScript: () => injectRuntimeScript,
      postSubmitGuardMs: 0,
      queuePollIntervalMs: 10,
      queueIdleConfirmations: 2,
    });

    const result = await service.sendPromptToAll({
      text: 'hello with image',
      image: imagePayload,
    });

    expect(result).toEqual({
      success: true,
      failures: ['pane-0: image attach failed (paste ignored by page)'],
    });
    expect(pane.stagePromptImagePayload).toHaveBeenCalledTimes(1);
    expect(pane.stagePromptImagePayload).toHaveBeenCalledWith(imagePayload);
    expect(executedScripts.some((script) => script.includes('bridge.injectPrompt'))).toBe(true);
    expect(executedScripts.some((script) => script.includes('attachImageFromClipboard'))).toBe(true);
    expect(executedScripts.some((script) => script.includes('"consume-token"'))).toBe(true);
    expect(executedScripts.some((script) => script.includes('QUJD'))).toBe(false);
    expect(executedScripts.some((script) => script.includes('clickSubmitButton'))).toBe(true);
  });

  it('waits for image readiness and degrades to text submit on readiness timeout', async () => {
    const injectRuntimeScript = 'inject-runtime-script';
    const executedScripts: string[] = [];
    const imagePayload: PromptImagePayload = {
      mimeType: 'image/png',
      base64Data: 'QUJD',
      sizeBytes: 3,
      source: 'clipboard',
    };

    const pane = createPaneTarget(0, async (script) => {
      if (script === injectRuntimeScript) {
        return undefined;
      }

      if (script.includes('bridge.getStatus')) {
        return {
          success: true,
          provider: 'chatgpt',
          isStreaming: false,
          isComplete: true,
          hasResponse: true,
        };
      }

      executedScripts.push(script);

      if (script.includes('waitForImageAttachmentReady')) {
        return { success: false, reason: 'Timed out waiting for image attachment readiness' };
      }

      if (script.includes('attachImageFromClipboard')) {
        return { success: true };
      }

      if (script.includes('clickSubmitButton')) {
        return { success: true };
      }

      if (script.includes('bridge.injectPrompt')) {
        return { success: true };
      }

      return undefined;
    });

    const service = new PromptDispatchService({
      getPaneTargets: () => [pane.target],
      getInjectRuntimeScript: () => injectRuntimeScript,
      postSubmitGuardMs: 0,
      queuePollIntervalMs: 10,
      queueIdleConfirmations: 2,
      imageReadyWaitTimeoutMs: 3000,
      imageReadyPollIntervalMs: 120,
    });

    const result = await service.sendPromptToAll({
      text: 'hello with image',
      image: imagePayload,
    });

    expect(result).toEqual({
      success: true,
      failures: [
        'pane-0: image readiness wait failed (Timed out waiting for image attachment readiness)',
      ],
    });
    expect(pane.stagePromptImagePayload).toHaveBeenCalledTimes(1);
    expect(pane.stagePromptImagePayload).toHaveBeenCalledWith(imagePayload);
    expect(executedScripts.some((script) => script.includes('attachImageFromClipboard'))).toBe(true);
    expect(executedScripts.some((script) => script.includes('waitForImageAttachmentReady'))).toBe(true);
    expect(executedScripts.some((script) => script.includes('(3000, 120)'))).toBe(true);
    expect(executedScripts.some((script) => script.includes('clickSubmitButton'))).toBe(true);
  });

  it('records image stage failure without running image attach script', async () => {
    const injectRuntimeScript = 'inject-runtime-script';
    const executedScripts: string[] = [];
    const imagePayload: PromptImagePayload = {
      mimeType: 'image/png',
      base64Data: 'QUJD',
      sizeBytes: 3,
      source: 'clipboard',
    };
    const pane = createPaneTarget(
      0,
      async (script) => {
        if (script === injectRuntimeScript) {
          return undefined;
        }

        if (script.includes('bridge.getStatus')) {
          return {
            success: true,
            provider: 'chatgpt',
            isStreaming: false,
            isComplete: true,
            hasResponse: true,
          };
        }

        executedScripts.push(script);

        if (script.includes('clickSubmitButton')) {
          return { success: true };
        }

        if (script.includes('bridge.injectPrompt')) {
          return { success: true };
        }

        return undefined;
      },
      async () => {
        throw new Error('stage channel unavailable');
      }
    );

    const service = new PromptDispatchService({
      getPaneTargets: () => [pane.target],
      getInjectRuntimeScript: () => injectRuntimeScript,
      postSubmitGuardMs: 0,
      queuePollIntervalMs: 10,
      queueIdleConfirmations: 2,
    });

    const result = await service.sendPromptToAll({
      text: 'hello with image',
      image: imagePayload,
    });

    expect(result).toEqual({
      success: true,
      failures: ['pane-0: image attach failed (stage channel unavailable)'],
    });
    expect(pane.stagePromptImagePayload).toHaveBeenCalledTimes(1);
    expect(pane.stagePromptImagePayload).toHaveBeenCalledWith(imagePayload);
    expect(executedScripts.some((script) => script.includes('bridge.injectPrompt'))).toBe(true);
    expect(executedScripts.some((script) => script.includes('attachImageFromClipboard'))).toBe(false);
    expect(executedScripts.some((script) => script.includes('clickSubmitButton'))).toBe(true);
  });

  it('rejects invalid image payload before pane dispatch', async () => {
    const pane = createPaneTarget(0, async () => ({ success: true }));
    const service = new PromptDispatchService({
      getPaneTargets: () => [pane.target],
      getInjectRuntimeScript: () => 'inject-runtime-script',
    });

    const result = await service.sendPromptToAll({
      text: 'hello',
      image: {
        mimeType: '',
        base64Data: 'QUJD',
        sizeBytes: 3,
        source: 'clipboard',
      },
    });

    expect(result.success).toBe(false);
    expect(result.failures).toEqual([
      'invalid-prompt-image: prompt image mimeType must be a non-empty image/* string',
    ]);
    expect(pane.executeJavaScript).not.toHaveBeenCalled();
  });

  it('attaches image payload to panes without injecting text or submitting', async () => {
    const injectRuntimeScript = 'inject-runtime-script';
    const executedScripts: string[] = [];
    const imagePayload: PromptImagePayload = {
      mimeType: 'image/png',
      base64Data: 'QUJD',
      sizeBytes: 3,
      source: 'clipboard',
    };

    const pane = createPaneTarget(0, async (script) => {
      if (script === injectRuntimeScript) {
        return undefined;
      }

      executedScripts.push(script);

      if (script.includes('attachImageFromClipboard')) {
        return { success: true };
      }

      if (script.includes('waitForImageAttachmentReady')) {
        return { success: true };
      }

      return undefined;
    });

    const service = new PromptDispatchService({
      getPaneTargets: () => [pane.target],
      getInjectRuntimeScript: () => injectRuntimeScript,
      imageReadyWaitTimeoutMs: 3000,
      imageReadyPollIntervalMs: 120,
    });

    const result = await service.attachPromptImageToAll(imagePayload);

    expect(result).toEqual({
      success: true,
      failures: [],
    });
    expect(pane.stagePromptImagePayload).toHaveBeenCalledTimes(1);
    expect(pane.stagePromptImagePayload).toHaveBeenCalledWith(imagePayload);
    expect(executedScripts.some((script) => script.includes('attachImageFromClipboard'))).toBe(true);
    expect(executedScripts.some((script) => script.includes('waitForImageAttachmentReady'))).toBe(true);
    expect(executedScripts.some((script) => script.includes('bridge.injectPrompt'))).toBe(false);
    expect(executedScripts.some((script) => script.includes('clickSubmitButton'))).toBe(false);
  });

  it('rejects invalid image payload for image-only dispatch', async () => {
    const pane = createPaneTarget(0, async () => ({ success: true }));
    const service = new PromptDispatchService({
      getPaneTargets: () => [pane.target],
      getInjectRuntimeScript: () => 'inject-runtime-script',
    });

    const result = await service.attachPromptImageToAll({
      mimeType: '',
      base64Data: 'QUJD',
      sizeBytes: 3,
      source: 'clipboard',
    });

    expect(result.success).toBe(false);
    expect(result.failures).toEqual([
      'invalid-prompt-image: prompt image mimeType must be a non-empty image/* string',
    ]);
    expect(pane.executeJavaScript).not.toHaveBeenCalled();
  });

  it('queues multiple prompts while busy and dispatches them in FIFO order after idle', async () => {
    vi.useFakeTimers();
    try {
      const injectRuntimeScript = 'inject-runtime-script';
      const promptScripts: string[] = [];
      let isStreaming = true;

      const pane = createPaneTarget(0, async (script) => {
        if (script === injectRuntimeScript) {
          return undefined;
        }

        if (script.includes('bridge.getStatus')) {
          return {
            success: true,
            provider: 'chatgpt',
            isStreaming,
            isComplete: !isStreaming,
            hasResponse: isStreaming,
          };
        }

        if (script.includes('bridge.injectPrompt')) {
          promptScripts.push(script);
          return { success: true };
        }

        return undefined;
      });

      const service = new PromptDispatchService({
        getPaneTargets: () => [pane.target],
        getInjectRuntimeScript: () => injectRuntimeScript,
        postSubmitGuardMs: 0,
        queuePollIntervalMs: 10,
        queueIdleConfirmations: 2,
      });

      const first = await service.sendPromptToAll('first');
      const second = await service.sendPromptToAll('second');

      expect(first).toEqual({ success: true, failures: [] });
      expect(second).toEqual({ success: true, failures: [] });
      expect(promptScripts).toHaveLength(0);

      isStreaming = false;
      await vi.advanceTimersByTimeAsync(120);

      expect(promptScripts).toHaveLength(2);
      expect(promptScripts[0]).toContain(JSON.stringify('first'));
      expect(promptScripts[1]).toContain(JSON.stringify('second'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('treats unknown status as busy and flushes once status becomes idle', async () => {
    vi.useFakeTimers();
    try {
      const injectRuntimeScript = 'inject-runtime-script';
      const promptScripts: string[] = [];
      let statusReady = false;

      const pane = createPaneTarget(0, async (script) => {
        if (script === injectRuntimeScript) {
          return undefined;
        }

        if (script.includes('bridge.getStatus')) {
          if (!statusReady) {
            return { success: false, reason: 'status probe failed' };
          }

          return {
            success: true,
            provider: 'chatgpt',
            isStreaming: false,
            isComplete: true,
            hasResponse: true,
          };
        }

        if (script.includes('bridge.injectPrompt')) {
          promptScripts.push(script);
          return { success: true };
        }

        return undefined;
      });

      const service = new PromptDispatchService({
        getPaneTargets: () => [pane.target],
        getInjectRuntimeScript: () => injectRuntimeScript,
        queuePollIntervalMs: 10,
        queueIdleConfirmations: 2,
      });

      const queued = await service.sendPromptToAll('queued-by-unknown');
      expect(queued).toEqual({ success: true, failures: [] });
      expect(promptScripts).toHaveLength(0);

      statusReady = true;
      await vi.advanceTimersByTimeAsync(60);

      expect(promptScripts).toHaveLength(1);
      expect(promptScripts[0]).toContain(JSON.stringify('queued-by-unknown'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops queued prompt after timeout when busy state does not clear', async () => {
    vi.useFakeTimers();
    try {
      const injectRuntimeScript = 'inject-runtime-script';
      const promptScripts: string[] = [];
      const onQueueTimeout = vi.fn<(paneIndex: number, promptText: string, waitedMs: number) => void>();
      const onQueuedDispatchFailure = vi.fn<(paneIndex: number, promptText: string, failures: string[]) => void>();

      const pane = createPaneTarget(0, async (script) => {
        if (script === injectRuntimeScript) {
          return undefined;
        }

        if (script.includes('bridge.getStatus')) {
          return {
            success: true,
            provider: 'chatgpt',
            isStreaming: true,
            isComplete: false,
            hasResponse: true,
          };
        }

        if (script.includes('bridge.injectPrompt')) {
          promptScripts.push(script);
          return { success: true };
        }

        return undefined;
      });

      const service = new PromptDispatchService({
        getPaneTargets: () => [pane.target],
        getInjectRuntimeScript: () => injectRuntimeScript,
        queuePollIntervalMs: 10,
        queueMaxWaitMs: 25,
        queueIdleConfirmations: 2,
        onQueueTimeout,
        onQueuedDispatchFailure,
      });

      const queued = await service.sendPromptToAll('timed-out-prompt');
      expect(queued).toEqual({ success: true, failures: [] });

      await vi.advanceTimersByTimeAsync(80);

      expect(promptScripts).toHaveLength(0);
      expect(onQueueTimeout).toHaveBeenCalledTimes(1);
      expect(onQueueTimeout).toHaveBeenCalledWith(0, 'timed-out-prompt', expect.any(Number));
      expect(onQueuedDispatchFailure).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('dispatches idle pane immediately while busy pane drains FIFO queue after idle', async () => {
    vi.useFakeTimers();
    try {
      const injectRuntimeScript = 'inject-runtime-script';
      const pane0PromptScripts: string[] = [];
      const pane1PromptScripts: string[] = [];
      let pane1Streaming = true;

      const pane0 = createPaneTarget(0, async (script) => {
        if (script === injectRuntimeScript) {
          return undefined;
        }

        if (script.includes('bridge.getStatus')) {
          return {
            success: true,
            provider: 'chatgpt',
            isStreaming: false,
            isComplete: true,
            hasResponse: true,
          };
        }

        if (script.includes('bridge.injectPrompt')) {
          pane0PromptScripts.push(script);
          return { success: true };
        }

        return undefined;
      });

      const pane1 = createPaneTarget(1, async (script) => {
        if (script === injectRuntimeScript) {
          return undefined;
        }

        if (script.includes('bridge.getStatus')) {
          return {
            success: true,
            provider: 'gemini',
            isStreaming: pane1Streaming,
            isComplete: !pane1Streaming,
            hasResponse: true,
          };
        }

        if (script.includes('bridge.injectPrompt')) {
          pane1PromptScripts.push(script);
          return { success: true };
        }

        return undefined;
      });

      const service = new PromptDispatchService({
        getPaneTargets: () => [pane0.target, pane1.target],
        getInjectRuntimeScript: () => injectRuntimeScript,
        postSubmitGuardMs: 0,
        queuePollIntervalMs: 10,
        queueIdleConfirmations: 2,
      });

      const first = await service.sendPromptToAll('first');
      const second = await service.sendPromptToAll('second');

      expect(first).toEqual({ success: true, failures: [] });
      expect(second).toEqual({ success: true, failures: [] });
      expect(pane0PromptScripts).toHaveLength(2);
      expect(pane0PromptScripts[0]).toContain(JSON.stringify('first'));
      expect(pane0PromptScripts[1]).toContain(JSON.stringify('second'));
      expect(pane1PromptScripts).toHaveLength(0);

      pane1Streaming = false;
      await vi.advanceTimersByTimeAsync(120);

      expect(pane1PromptScripts).toHaveLength(2);
      expect(pane1PromptScripts[0]).toContain(JSON.stringify('first'));
      expect(pane1PromptScripts[1]).toContain(JSON.stringify('second'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('emits queue snapshots when pending queue changes', async () => {
    vi.useFakeTimers();
    try {
      const injectRuntimeScript = 'inject-runtime-script';
      const onQueueStateChanged = vi.fn<(
        snapshot: {
          entries: Array<{
            queueItemId: string;
            roundId: number;
            paneIndex: number;
            text: string;
          }>;
        }
      ) => void>();
      let isStreaming = true;

      const pane = createPaneTarget(0, async (script) => {
        if (script === injectRuntimeScript) {
          return undefined;
        }

        if (script.includes('bridge.getStatus')) {
          return {
            success: true,
            provider: 'chatgpt',
            isStreaming,
            isComplete: !isStreaming,
            hasResponse: isStreaming,
          };
        }

        if (script.includes('bridge.injectPrompt')) {
          return { success: true };
        }

        return undefined;
      });

      const service = new PromptDispatchService({
        getPaneTargets: () => [pane.target],
        getInjectRuntimeScript: () => injectRuntimeScript,
        postSubmitGuardMs: 0,
        queuePollIntervalMs: 10,
        queueIdleConfirmations: 2,
        onQueueStateChanged,
      });

      await service.sendPromptToAll('first');
      await service.sendPromptToAll('second');

      expect(onQueueStateChanged).toHaveBeenCalledTimes(2);
      expect(onQueueStateChanged.mock.calls[0]?.[0]).toMatchObject({
        entries: [{ paneIndex: 0, text: 'first', roundId: 1, queueItemId: 'q-1' }],
      });
      expect(onQueueStateChanged.mock.calls[1]?.[0]).toMatchObject({
        entries: [
          { paneIndex: 0, text: 'first', roundId: 1, queueItemId: 'q-1' },
          { paneIndex: 0, text: 'second', roundId: 2, queueItemId: 'q-2' },
        ],
      });

      isStreaming = false;
      await vi.advanceTimersByTimeAsync(120);

      const snapshots = onQueueStateChanged.mock.calls.map(([snapshot]) => snapshot);
      const finalSnapshot = snapshots[snapshots.length - 1];
      expect(finalSnapshot).toEqual({ entries: [] });
    } finally {
      vi.useRealTimers();
    }
  });

  it('removes queued item by queueItemId and dispatches remaining prompts', async () => {
    vi.useFakeTimers();
    try {
      const injectRuntimeScript = 'inject-runtime-script';
      let isStreaming = true;
      const promptScripts: string[] = [];
      const onQueueStateChanged = vi.fn<(
        snapshot: {
          entries: Array<{
            queueItemId: string;
            roundId: number;
            paneIndex: number;
            text: string;
          }>;
        }
      ) => void>();

      const pane = createPaneTarget(0, async (script) => {
        if (script === injectRuntimeScript) {
          return undefined;
        }
        if (script.includes('bridge.getStatus')) {
          return {
            success: true,
            provider: 'chatgpt',
            isStreaming,
            isComplete: !isStreaming,
            hasResponse: isStreaming,
          };
        }
        if (script.includes('bridge.injectPrompt')) {
          promptScripts.push(script);
          return { success: true };
        }
        return undefined;
      });

      const service = new PromptDispatchService({
        getPaneTargets: () => [pane.target],
        getInjectRuntimeScript: () => injectRuntimeScript,
        postSubmitGuardMs: 0,
        queuePollIntervalMs: 10,
        queueIdleConfirmations: 1,
        onQueueStateChanged,
      });

      await service.sendPromptToAll('first');
      await service.sendPromptToAll('second');
      expect(promptScripts).toHaveLength(0);

      const latestSnapshot = onQueueStateChanged.mock.calls[onQueueStateChanged.mock.calls.length - 1]?.[0];
      expect(latestSnapshot?.entries).toHaveLength(2);
      const firstQueueItemId = latestSnapshot?.entries[0]?.queueItemId;
      expect(firstQueueItemId).toBe('q-1');

      const removedCount = service.removeQueuedPromptItem(firstQueueItemId ?? '');
      expect(removedCount).toBe(1);

      isStreaming = false;
      await vi.advanceTimersByTimeAsync(80);

      expect(promptScripts).toHaveLength(1);
      expect(promptScripts[0]).toContain(JSON.stringify('second'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('removes queued entries by roundId across panes', async () => {
    vi.useFakeTimers();
    try {
      const injectRuntimeScript = 'inject-runtime-script';
      let pane0Streaming = true;
      let pane1Streaming = true;
      const pane0PromptScripts: string[] = [];
      const pane1PromptScripts: string[] = [];

      const pane0 = createPaneTarget(0, async (script) => {
        if (script === injectRuntimeScript) {
          return undefined;
        }
        if (script.includes('bridge.getStatus')) {
          return {
            success: true,
            provider: 'chatgpt',
            isStreaming: pane0Streaming,
            isComplete: !pane0Streaming,
            hasResponse: pane0Streaming,
          };
        }
        if (script.includes('bridge.injectPrompt')) {
          pane0PromptScripts.push(script);
          return { success: true };
        }
        return undefined;
      });

      const pane1 = createPaneTarget(1, async (script) => {
        if (script === injectRuntimeScript) {
          return undefined;
        }
        if (script.includes('bridge.getStatus')) {
          return {
            success: true,
            provider: 'gemini',
            isStreaming: pane1Streaming,
            isComplete: !pane1Streaming,
            hasResponse: pane1Streaming,
          };
        }
        if (script.includes('bridge.injectPrompt')) {
          pane1PromptScripts.push(script);
          return { success: true };
        }
        return undefined;
      });

      const service = new PromptDispatchService({
        getPaneTargets: () => [pane0.target, pane1.target],
        getInjectRuntimeScript: () => injectRuntimeScript,
        postSubmitGuardMs: 0,
        queuePollIntervalMs: 10,
        queueIdleConfirmations: 1,
      });

      await service.sendPromptToAll('first');
      await service.sendPromptToAll('second');

      const removedCount = service.removeQueuedPromptRound(1);
      expect(removedCount).toBe(2);

      pane0Streaming = false;
      pane1Streaming = false;
      await vi.advanceTimersByTimeAsync(120);

      expect(pane0PromptScripts).toHaveLength(1);
      expect(pane1PromptScripts).toHaveLength(1);
      expect(pane0PromptScripts[0]).toContain(JSON.stringify('second'));
      expect(pane1PromptScripts[0]).toContain(JSON.stringify('second'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears all queued prompts and leaves no pending dispatch', async () => {
    vi.useFakeTimers();
    try {
      const injectRuntimeScript = 'inject-runtime-script';
      let isStreaming = true;
      const promptScripts: string[] = [];

      const pane = createPaneTarget(0, async (script) => {
        if (script === injectRuntimeScript) {
          return undefined;
        }
        if (script.includes('bridge.getStatus')) {
          return {
            success: true,
            provider: 'chatgpt',
            isStreaming,
            isComplete: !isStreaming,
            hasResponse: isStreaming,
          };
        }
        if (script.includes('bridge.injectPrompt')) {
          promptScripts.push(script);
          return { success: true };
        }
        return undefined;
      });

      const service = new PromptDispatchService({
        getPaneTargets: () => [pane.target],
        getInjectRuntimeScript: () => injectRuntimeScript,
        postSubmitGuardMs: 0,
        queuePollIntervalMs: 10,
        queueIdleConfirmations: 1,
      });

      await service.sendPromptToAll('first');
      await service.sendPromptToAll('second');

      const removedCount = service.clearQueuedPrompts();
      expect(removedCount).toBe(2);

      isStreaming = false;
      await vi.advanceTimersByTimeAsync(120);

      expect(promptScripts).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('applies post-submit guard to avoid immediate false-idle redispatch', async () => {
    vi.useFakeTimers();
    try {
      const injectRuntimeScript = 'inject-runtime-script';
      const promptScripts: string[] = [];

      const pane = createPaneTarget(0, async (script) => {
        if (script === injectRuntimeScript) {
          return undefined;
        }

        if (script.includes('bridge.getStatus')) {
          return {
            success: true,
            provider: 'gemini',
            isStreaming: false,
            isComplete: true,
            hasResponse: true,
          };
        }

        if (script.includes('bridge.injectPrompt')) {
          promptScripts.push(script);
          return { success: true };
        }

        return undefined;
      });

      const service = new PromptDispatchService({
        getPaneTargets: () => [pane.target],
        getInjectRuntimeScript: () => injectRuntimeScript,
        postSubmitGuardMs: 50,
        queuePollIntervalMs: 10,
        queueIdleConfirmations: 1,
      });

      const first = await service.sendPromptToAll('first');
      const second = await service.sendPromptToAll('second');

      expect(first).toEqual({ success: true, failures: [] });
      expect(second).toEqual({ success: true, failures: [] });
      expect(promptScripts).toHaveLength(1);
      expect(promptScripts[0]).toContain(JSON.stringify('first'));

      await vi.advanceTimersByTimeAsync(80);

      expect(promptScripts).toHaveLength(2);
      expect(promptScripts[1]).toContain(JSON.stringify('second'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('collects mixed per-pane success and failure outcomes', async () => {
    const injectRuntimeScript = 'inject-runtime-script';
    const promptEvalScript = 'prompt-eval-script';

    const pane0 = createPaneTarget(0, async (script) => {
      if (script === promptEvalScript) {
        return { success: true };
      }
      return undefined;
    });
    const pane1 = createPaneTarget(1, async (script) => {
      if (script === promptEvalScript) {
        return { success: false, reason: 'bridge rejected prompt' };
      }
      return undefined;
    });
    const pane2 = createPaneTarget(2, async (script) => {
      if (script === promptEvalScript) {
        return { success: false };
      }
      return undefined;
    });

    const service = new PromptDispatchService({
      getPaneTargets: () => [pane0.target, pane1.target, pane2.target],
      getInjectRuntimeScript: () => injectRuntimeScript,
    });

    const result = await service.executePromptEvalScriptOnAllPanes(promptEvalScript);

    expect(result).toEqual({
      success: false,
      failures: [
        'pane-1: bridge rejected prompt',
        'pane-2: prompt injection failed',
      ],
    });

    expect(pane0.executeJavaScript).toHaveBeenNthCalledWith(1, injectRuntimeScript, true);
    expect(pane0.executeJavaScript).toHaveBeenNthCalledWith(2, promptEvalScript, true);
    expect(pane1.executeJavaScript).toHaveBeenNthCalledWith(1, injectRuntimeScript, true);
    expect(pane1.executeJavaScript).toHaveBeenNthCalledWith(2, promptEvalScript, true);
    expect(pane2.executeJavaScript).toHaveBeenNthCalledWith(1, injectRuntimeScript, true);
    expect(pane2.executeJavaScript).toHaveBeenNthCalledWith(2, promptEvalScript, true);
  });

  it('captures thrown executeJavaScript errors and keeps dispatching to remaining panes', async () => {
    const injectRuntimeScript = 'inject-runtime-script';
    const promptEvalScript = 'prompt-eval-script';
    const onPaneExecutionError = vi.fn<(paneIndex: number, error: unknown) => void>();

    const pane0 = createPaneTarget(0, async (script) => {
      if (script === injectRuntimeScript) {
        throw new Error('inject runtime crashed');
      }
      return { success: true };
    });
    const pane1 = createPaneTarget(1, async (script) => {
      if (script === promptEvalScript) {
        throw new Error('prompt execution crashed');
      }
      return undefined;
    });
    const pane2 = createPaneTarget(2, async (script) => {
      if (script === promptEvalScript) {
        return { success: true };
      }
      return undefined;
    });

    const service = new PromptDispatchService({
      getPaneTargets: () => [pane0.target, pane1.target, pane2.target],
      getInjectRuntimeScript: () => injectRuntimeScript,
      onPaneExecutionError,
    });

    const result = await service.executePromptEvalScriptOnAllPanes(promptEvalScript);

    expect(result).toEqual({
      success: false,
      failures: [
        'pane-0: inject runtime crashed',
        'pane-1: prompt execution crashed',
      ],
    });

    expect(onPaneExecutionError).toHaveBeenCalledTimes(2);
    expect(onPaneExecutionError).toHaveBeenNthCalledWith(1, 0, expect.any(Error));
    expect(onPaneExecutionError).toHaveBeenNthCalledWith(2, 1, expect.any(Error));
    expect(pane2.executeJavaScript).toHaveBeenNthCalledWith(1, injectRuntimeScript, true);
    expect(pane2.executeJavaScript).toHaveBeenNthCalledWith(2, promptEvalScript, true);
  });
});
