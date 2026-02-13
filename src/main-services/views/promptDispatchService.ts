import {
  buildPromptDraftSyncEvalScript,
  buildPromptInjectionEvalScript,
  type PromptInjectionResult,
} from './promptInjection.js';

export interface PromptDispatchPaneExecutionTarget {
  paneIndex: number;
  executeJavaScript(script: string, userGesture?: boolean): Promise<unknown>;
}

export interface PromptDispatchResult {
  success: boolean;
  failures: string[];
}

export interface PromptDispatchServiceOptions {
  getPaneTargets: () => PromptDispatchPaneExecutionTarget[];
  getInjectRuntimeScript: () => string | null;
  onPaneExecutionError?: (paneIndex: number, error: unknown) => void;
}

function toFailureReason(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export class PromptDispatchService {
  private readonly getPaneTargets: () => PromptDispatchPaneExecutionTarget[];
  private readonly getInjectRuntimeScript: () => string | null;
  private readonly onPaneExecutionError: (paneIndex: number, error: unknown) => void;

  constructor(options: PromptDispatchServiceOptions) {
    this.getPaneTargets = options.getPaneTargets;
    this.getInjectRuntimeScript = options.getInjectRuntimeScript;
    this.onPaneExecutionError = options.onPaneExecutionError ?? ((paneIndex, error) => {
      console.error(`[PromptDispatchService] Failed to send prompt to pane ${paneIndex}:`, error);
    });
  }

  async sendPromptToAll(text: string): Promise<PromptDispatchResult> {
    let promptEvalScript: string;

    try {
      promptEvalScript = buildPromptInjectionEvalScript(text);
    } catch (error) {
      return {
        success: false,
        failures: [`invalid-prompt: ${toFailureReason(error)}`],
      };
    }

    return this.executePromptEvalScriptOnAllPanes(promptEvalScript);
  }

  async syncPromptDraftToAll(text: string): Promise<PromptDispatchResult> {
    let draftSyncEvalScript: string;

    try {
      draftSyncEvalScript = buildPromptDraftSyncEvalScript(text);
    } catch (error) {
      return {
        success: false,
        failures: [`invalid-prompt-draft: ${toFailureReason(error)}`],
      };
    }

    return this.executePromptEvalScriptOnAllPanes(draftSyncEvalScript);
  }

  async executePromptEvalScriptOnAllPanes(promptEvalScript: string): Promise<PromptDispatchResult> {
    const paneTargets = this.getPaneTargets();
    const failures: string[] = [];
    const injectRuntimeScript = this.getInjectRuntimeScript();

    if (!injectRuntimeScript) {
      return {
        success: false,
        failures: paneTargets.map((pane) => `pane-${pane.paneIndex}: inject runtime not available`),
      };
    }

    for (const pane of paneTargets) {
      try {
        await pane.executeJavaScript(injectRuntimeScript, true);
        const result = await pane.executeJavaScript(
          promptEvalScript,
          true
        ) as PromptInjectionResult | undefined;

        if (!result?.success) {
          const reason = result?.reason ?? 'prompt injection failed';
          failures.push(`pane-${pane.paneIndex}: ${reason}`);
        }
      } catch (error) {
        this.onPaneExecutionError(pane.paneIndex, error);
        failures.push(`pane-${pane.paneIndex}: ${toFailureReason(error)}`);
      }
    }

    return {
      success: failures.length === 0,
      failures,
    };
  }
}
