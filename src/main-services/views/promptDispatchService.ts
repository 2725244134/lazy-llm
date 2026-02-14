import {
  buildPromptDraftSyncEvalScript,
  buildPromptInjectionEvalScript,
  buildPromptStatusEvalScript,
  type PromptInjectionResult,
  type PromptStatusEvalResult,
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
  queuePollIntervalMs?: number;
  queueMaxWaitMs?: number;
  queueIdleConfirmations?: number;
  now?: () => number;
  setTimer?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
  onQueuedDispatchFailure?: (promptText: string, failures: string[]) => void;
  onQueueTimeout?: (promptText: string, waitedMs: number) => void;
}

const DEFAULT_QUEUE_POLL_INTERVAL_MS = 350;
const DEFAULT_QUEUE_MAX_WAIT_MS = 90_000;
const DEFAULT_QUEUE_IDLE_CONFIRMATIONS = 2;

type PaneBusyState = 'busy' | 'idle' | 'unknown';

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
  private readonly queuePollIntervalMs: number;
  private readonly queueMaxWaitMs: number;
  private readonly queueIdleConfirmations: number;
  private readonly now: () => number;
  private readonly setTimer: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  private readonly clearTimer: (timer: ReturnType<typeof setTimeout>) => void;
  private readonly onQueuedDispatchFailure: (promptText: string, failures: string[]) => void;
  private readonly onQueueTimeout: (promptText: string, waitedMs: number) => void;

  private queuedPromptText: string | null = null;
  private queueStartedAtMs: number | null = null;
  private queueIdleStreak = 0;
  private queueTimer: ReturnType<typeof setTimeout> | null = null;
  private queueDrainInProgress = false;

  constructor(options: PromptDispatchServiceOptions) {
    this.getPaneTargets = options.getPaneTargets;
    this.getInjectRuntimeScript = options.getInjectRuntimeScript;
    this.onPaneExecutionError = options.onPaneExecutionError ?? ((paneIndex, error) => {
      console.error(`[PromptDispatchService] Failed to send prompt to pane ${paneIndex}:`, error);
    });
    this.queuePollIntervalMs = Math.max(
      20,
      options.queuePollIntervalMs ?? DEFAULT_QUEUE_POLL_INTERVAL_MS
    );
    this.queueMaxWaitMs = Math.max(
      this.queuePollIntervalMs,
      options.queueMaxWaitMs ?? DEFAULT_QUEUE_MAX_WAIT_MS
    );
    this.queueIdleConfirmations = Math.max(
      1,
      Math.floor(options.queueIdleConfirmations ?? DEFAULT_QUEUE_IDLE_CONFIRMATIONS)
    );
    this.now = options.now ?? (() => Date.now());
    this.setTimer = options.setTimer ?? ((callback, delayMs) => setTimeout(callback, delayMs));
    this.clearTimer = options.clearTimer ?? ((timer) => clearTimeout(timer));
    this.onQueuedDispatchFailure = options.onQueuedDispatchFailure ?? ((promptText, failures) => {
      console.error(
        '[PromptDispatchService] Failed to deliver queued prompt',
        { promptLength: promptText.length, failures }
      );
    });
    this.onQueueTimeout = options.onQueueTimeout ?? ((promptText, waitedMs) => {
      console.error(
        '[PromptDispatchService] Dropped queued prompt after timeout',
        { promptLength: promptText.length, waitedMs }
      );
    });
  }

  async sendPromptToAll(text: string): Promise<PromptDispatchResult> {
    const normalizedPrompt = text.trim();
    let promptEvalScript: string;

    try {
      promptEvalScript = buildPromptInjectionEvalScript(text);
    } catch (error) {
      return {
        success: false,
        failures: [`invalid-prompt: ${toFailureReason(error)}`],
      };
    }

    if (this.queueDrainInProgress) {
      this.queueLatestPrompt(normalizedPrompt);
      return { success: true, failures: [] };
    }

    const paneTargets = this.getPaneTargets();
    const injectRuntimeScript = this.getInjectRuntimeScript();
    if (!injectRuntimeScript) {
      return {
        success: false,
        failures: this.buildInjectRuntimeUnavailableFailures(paneTargets),
      };
    }

    const busyState = await this.detectBusyStateOnAllPanes(paneTargets, injectRuntimeScript);
    if (busyState !== 'idle') {
      this.queueLatestPrompt(normalizedPrompt);
      return { success: true, failures: [] };
    }

    this.resetQueueState();
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
        failures: this.buildInjectRuntimeUnavailableFailures(paneTargets),
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

  private buildInjectRuntimeUnavailableFailures(
    paneTargets: PromptDispatchPaneExecutionTarget[]
  ): string[] {
    return paneTargets.map((pane) => `pane-${pane.paneIndex}: inject runtime not available`);
  }

  private resolvePaneBusyState(result: PromptStatusEvalResult | undefined): PaneBusyState {
    if (!result || result.success !== true) {
      return 'unknown';
    }

    if (result.isStreaming === true) {
      return 'busy';
    }

    // Some providers do not expose a "complete" marker before the first turn.
    // Treat any non-streaming successful status as idle to avoid startup deadlock.
    return 'idle';
  }

  private async detectBusyStateOnAllPanes(
    paneTargets: PromptDispatchPaneExecutionTarget[],
    injectRuntimeScript: string
  ): Promise<PaneBusyState> {
    const statusEvalScript = buildPromptStatusEvalScript();
    let hasBusyPane = false;
    let hasUnknownPane = false;

    for (const pane of paneTargets) {
      try {
        await pane.executeJavaScript(injectRuntimeScript, true);
        const statusResult = await pane.executeJavaScript(
          statusEvalScript,
          true
        ) as PromptStatusEvalResult | undefined;
        const busyState = this.resolvePaneBusyState(statusResult);

        if (busyState === 'busy') {
          hasBusyPane = true;
          continue;
        }

        if (busyState === 'unknown') {
          hasUnknownPane = true;
        }
      } catch (error) {
        hasUnknownPane = true;
        this.onPaneExecutionError(pane.paneIndex, error);
      }
    }

    if (hasBusyPane) {
      return 'busy';
    }

    if (hasUnknownPane) {
      return 'unknown';
    }

    return 'idle';
  }

  private queueLatestPrompt(promptText: string): void {
    this.queuedPromptText = promptText;
    if (this.queueStartedAtMs === null) {
      this.queueStartedAtMs = this.now();
    }
    this.queueIdleStreak = 0;
    this.scheduleQueueDrain();
  }

  private scheduleQueueDrain(delayMs = this.queuePollIntervalMs): void {
    if (this.queueTimer !== null || this.queuedPromptText === null) {
      return;
    }

    this.queueTimer = this.setTimer(() => {
      this.queueTimer = null;
      void this.drainQueuedPrompt();
    }, delayMs);
  }

  private clearQueueTimer(): void {
    if (this.queueTimer === null) {
      return;
    }

    this.clearTimer(this.queueTimer);
    this.queueTimer = null;
  }

  private resetQueueState(): void {
    this.queuedPromptText = null;
    this.queueStartedAtMs = null;
    this.queueIdleStreak = 0;
    this.clearQueueTimer();
  }

  private async drainQueuedPrompt(): Promise<void> {
    if (this.queueDrainInProgress || this.queuedPromptText === null) {
      return;
    }

    this.queueDrainInProgress = true;
    try {
      const paneTargets = this.getPaneTargets();
      const injectRuntimeScript = this.getInjectRuntimeScript();
      if (!injectRuntimeScript) {
        const queuedPrompt = this.queuedPromptText;
        this.resetQueueState();
        if (queuedPrompt !== null) {
          this.onQueuedDispatchFailure(
            queuedPrompt,
            this.buildInjectRuntimeUnavailableFailures(paneTargets)
          );
        }
        return;
      }

      const waitedMs = this.queueStartedAtMs === null ? 0 : this.now() - this.queueStartedAtMs;
      if (waitedMs > this.queueMaxWaitMs) {
        const queuedPrompt = this.queuedPromptText;
        this.resetQueueState();
        if (queuedPrompt !== null) {
          this.onQueueTimeout(queuedPrompt, waitedMs);
        }
        return;
      }

      const busyState = await this.detectBusyStateOnAllPanes(paneTargets, injectRuntimeScript);
      if (busyState !== 'idle') {
        this.queueIdleStreak = 0;
        this.scheduleQueueDrain();
        return;
      }

      this.queueIdleStreak += 1;
      if (this.queueIdleStreak < this.queueIdleConfirmations) {
        this.scheduleQueueDrain();
        return;
      }

      const promptText = this.queuedPromptText;
      this.queuedPromptText = null;
      this.queueStartedAtMs = null;
      this.queueIdleStreak = 0;

      if (promptText === null) {
        return;
      }

      let promptEvalScript: string;
      try {
        promptEvalScript = buildPromptInjectionEvalScript(promptText);
      } catch (error) {
        this.onQueuedDispatchFailure(promptText, [`invalid-queued-prompt: ${toFailureReason(error)}`]);
        return;
      }

      const result = await this.executePromptEvalScriptOnAllPanes(promptEvalScript);
      if (!result.success) {
        this.onQueuedDispatchFailure(promptText, result.failures);
      }
    } catch (error) {
      console.error('[PromptDispatchService] Unexpected error while draining prompt queue:', error);
    } finally {
      this.queueDrainInProgress = false;
      if (this.queuedPromptText !== null) {
        if (this.queueStartedAtMs === null) {
          this.queueStartedAtMs = this.now();
        }
        this.scheduleQueueDrain();
      }
    }
  }
}
