import { describe, expect, it, vi } from 'vitest';
import {
  PromptDispatchService,
  type PromptDispatchPaneExecutionTarget,
} from './promptDispatchService';

type ExecuteJavaScriptFn = (script: string, userGesture?: boolean) => Promise<unknown>;

function createPaneTarget(paneIndex: number, executeImpl: ExecuteJavaScriptFn): {
  target: PromptDispatchPaneExecutionTarget;
  executeJavaScript: ReturnType<typeof vi.fn<ExecuteJavaScriptFn>>;
} {
  const executeJavaScript = vi.fn<ExecuteJavaScriptFn>(executeImpl);
  return {
    target: {
      paneIndex,
      executeJavaScript,
    },
    executeJavaScript,
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

  it('queues latest prompt while busy and dispatches only the newest prompt after idle', async () => {
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

      const first = await service.sendPromptToAll('first');
      const second = await service.sendPromptToAll('second');

      expect(first).toEqual({ success: true, failures: [] });
      expect(second).toEqual({ success: true, failures: [] });
      expect(promptScripts).toHaveLength(0);

      isStreaming = false;
      await vi.advanceTimersByTimeAsync(60);

      expect(promptScripts).toHaveLength(1);
      expect(promptScripts[0]).toContain(JSON.stringify('second'));
      expect(promptScripts[0]).not.toContain(JSON.stringify('first'));
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
      const onQueueTimeout = vi.fn<(promptText: string, waitedMs: number) => void>();
      const onQueuedDispatchFailure = vi.fn<(promptText: string, failures: string[]) => void>();

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
      expect(onQueueTimeout).toHaveBeenCalledWith('timed-out-prompt', expect.any(Number));
      expect(onQueuedDispatchFailure).not.toHaveBeenCalled();
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
