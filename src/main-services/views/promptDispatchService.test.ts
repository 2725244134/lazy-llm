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
