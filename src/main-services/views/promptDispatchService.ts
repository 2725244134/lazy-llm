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
  postSubmitGuardMs?: number;
  queuePollIntervalMs?: number;
  queueMaxWaitMs?: number;
  queueIdleConfirmations?: number;
  now?: () => number;
  setTimer?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
  onQueuedDispatchFailure?: (paneIndex: number, promptText: string, failures: string[]) => void;
  onQueueTimeout?: (paneIndex: number, promptText: string, waitedMs: number) => void;
}

const DEFAULT_QUEUE_POLL_INTERVAL_MS = 350;
const DEFAULT_QUEUE_MAX_WAIT_MS = 90_000;
const DEFAULT_QUEUE_IDLE_CONFIRMATIONS = 2;
const DEFAULT_POST_SUBMIT_GUARD_MS = 2_000;

type PaneBusyState = 'busy' | 'idle' | 'unknown';

type PanePromptDispatchOutcome =
  | { kind: 'dispatched' }
  | { kind: 'queued' }
  | { kind: 'failed'; failure: string };

interface PaneQueueState {
  queuedPromptText: string | null;
  queueStartedAtMs: number | null;
  idleStreak: number;
  timer: ReturnType<typeof setTimeout> | null;
  drainInProgress: boolean;
}

interface PaneScriptExecutionResult {
  success: boolean;
  reason?: string;
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
  private readonly postSubmitGuardMs: number;
  private readonly queuePollIntervalMs: number;
  private readonly queueMaxWaitMs: number;
  private readonly queueIdleConfirmations: number;
  private readonly now: () => number;
  private readonly setTimer: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  private readonly clearTimer: (timer: ReturnType<typeof setTimeout>) => void;
  private readonly onQueuedDispatchFailure: (paneIndex: number, promptText: string, failures: string[]) => void;
  private readonly onQueueTimeout: (paneIndex: number, promptText: string, waitedMs: number) => void;

  private readonly paneQueueStates = new Map<number, PaneQueueState>();
  private readonly panePostSubmitGuardUntilMs = new Map<number, number>();

  constructor(options: PromptDispatchServiceOptions) {
    this.getPaneTargets = options.getPaneTargets;
    this.getInjectRuntimeScript = options.getInjectRuntimeScript;
    this.onPaneExecutionError = options.onPaneExecutionError ?? ((paneIndex, error) => {
      console.error(`[PromptDispatchService] Failed to send prompt to pane ${paneIndex}:`, error);
    });
    this.postSubmitGuardMs = Math.max(
      0,
      options.postSubmitGuardMs ?? DEFAULT_POST_SUBMIT_GUARD_MS
    );
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
    this.onQueuedDispatchFailure = options.onQueuedDispatchFailure ?? ((paneIndex, promptText, failures) => {
      console.error(
        '[PromptDispatchService] Failed to deliver queued prompt',
        {
          paneIndex,
          promptLength: promptText.length,
          failures,
        }
      );
    });
    this.onQueueTimeout = options.onQueueTimeout ?? ((paneIndex, promptText, waitedMs) => {
      console.error(
        '[PromptDispatchService] Dropped queued prompt after timeout',
        {
          paneIndex,
          promptLength: promptText.length,
          waitedMs,
        }
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

    const paneTargets = this.getPaneTargets();
    const injectRuntimeScript = this.getInjectRuntimeScript();
    if (!injectRuntimeScript) {
      return {
        success: false,
        failures: this.buildInjectRuntimeUnavailableFailures(paneTargets),
      };
    }

    const statusEvalScript = buildPromptStatusEvalScript();
    const outcomes = await Promise.all(
      paneTargets.map((pane) =>
        this.dispatchPromptToPane(
          pane,
          normalizedPrompt,
          promptEvalScript,
          injectRuntimeScript,
          statusEvalScript
        )
      )
    );

    const failures: string[] = [];
    let dispatchedCount = 0;
    let queuedCount = 0;

    for (const outcome of outcomes) {
      if (outcome.kind === 'dispatched') {
        dispatchedCount += 1;
        continue;
      }

      if (outcome.kind === 'queued') {
        queuedCount += 1;
        continue;
      }

      failures.push(outcome.failure);
    }

    return {
      success: dispatchedCount > 0 || queuedCount > 0,
      failures,
    };
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
      const executionResult = await this.executePromptEvalScriptOnPane(
        pane,
        injectRuntimeScript,
        promptEvalScript
      );
      if (!executionResult.success) {
        failures.push(`pane-${pane.paneIndex}: ${executionResult.reason ?? 'prompt injection failed'}`);
      }
    }

    return {
      success: failures.length === 0,
      failures,
    };
  }

  private async dispatchPromptToPane(
    pane: PromptDispatchPaneExecutionTarget,
    normalizedPrompt: string,
    promptEvalScript: string,
    injectRuntimeScript: string,
    statusEvalScript: string
  ): Promise<PanePromptDispatchOutcome> {
    const busyState = await this.detectPaneBusyState(
      pane,
      injectRuntimeScript,
      statusEvalScript
    );

    if (busyState !== 'idle') {
      this.queueLatestPromptForPane(pane.paneIndex, normalizedPrompt);
      return { kind: 'queued' };
    }

    const executionResult = await this.executePromptEvalScriptOnPane(
      pane,
      injectRuntimeScript,
      promptEvalScript
    );

    if (executionResult.success) {
      this.markPanePostSubmitGuard(pane.paneIndex);
      return { kind: 'dispatched' };
    }

    return {
      kind: 'failed',
      failure: `pane-${pane.paneIndex}: ${executionResult.reason ?? 'prompt injection failed'}`,
    };
  }

  private async executePromptEvalScriptOnPane(
    pane: PromptDispatchPaneExecutionTarget,
    injectRuntimeScript: string,
    promptEvalScript: string
  ): Promise<PaneScriptExecutionResult> {
    try {
      await pane.executeJavaScript(injectRuntimeScript, true);
      const result = await pane.executeJavaScript(
        promptEvalScript,
        true
      ) as PromptInjectionResult | undefined;

      if (result?.success) {
        return { success: true };
      }

      return {
        success: false,
        reason: result?.reason ?? 'prompt injection failed',
      };
    } catch (error) {
      this.onPaneExecutionError(pane.paneIndex, error);
      return {
        success: false,
        reason: toFailureReason(error),
      };
    }
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

    if (result.isComplete === true) {
      return 'idle';
    }

    if (result.hasResponse === false) {
      return 'idle';
    }

    return 'unknown';
  }

  private async detectPaneBusyState(
    pane: PromptDispatchPaneExecutionTarget,
    injectRuntimeScript: string,
    statusEvalScript: string
  ): Promise<PaneBusyState> {
    if (this.isPaneInPostSubmitGuard(pane.paneIndex)) {
      return 'busy';
    }

    try {
      await pane.executeJavaScript(injectRuntimeScript, true);
      const statusResult = await pane.executeJavaScript(
        statusEvalScript,
        true
      ) as PromptStatusEvalResult | undefined;
      return this.resolvePaneBusyState(statusResult);
    } catch (error) {
      this.onPaneExecutionError(pane.paneIndex, error);
      return 'unknown';
    }
  }

  private getPaneQueueState(paneIndex: number): PaneQueueState {
    const existing = this.paneQueueStates.get(paneIndex);
    if (existing) {
      return existing;
    }

    const initialState: PaneQueueState = {
      queuedPromptText: null,
      queueStartedAtMs: null,
      idleStreak: 0,
      timer: null,
      drainInProgress: false,
    };
    this.paneQueueStates.set(paneIndex, initialState);
    return initialState;
  }

  private findPaneTargetByIndex(paneIndex: number): PromptDispatchPaneExecutionTarget | null {
    for (const pane of this.getPaneTargets()) {
      if (pane.paneIndex === paneIndex) {
        return pane;
      }
    }

    return null;
  }

  private markPanePostSubmitGuard(paneIndex: number): void {
    if (this.postSubmitGuardMs <= 0) {
      this.panePostSubmitGuardUntilMs.delete(paneIndex);
      return;
    }

    this.panePostSubmitGuardUntilMs.set(
      paneIndex,
      this.now() + this.postSubmitGuardMs
    );
  }

  private isPaneInPostSubmitGuard(paneIndex: number): boolean {
    const guardUntilMs = this.panePostSubmitGuardUntilMs.get(paneIndex);
    if (guardUntilMs === undefined) {
      return false;
    }

    if (this.now() <= guardUntilMs) {
      return true;
    }

    this.panePostSubmitGuardUntilMs.delete(paneIndex);
    return false;
  }

  private queueLatestPromptForPane(paneIndex: number, promptText: string): void {
    const state = this.getPaneQueueState(paneIndex);
    state.queuedPromptText = promptText;
    if (state.queueStartedAtMs === null) {
      state.queueStartedAtMs = this.now();
    }
    state.idleStreak = 0;
    this.schedulePaneQueueDrain(paneIndex, state);
  }

  private schedulePaneQueueDrain(
    paneIndex: number,
    state: PaneQueueState,
    delayMs = this.queuePollIntervalMs
  ): void {
    if (state.timer !== null || state.queuedPromptText === null || state.drainInProgress) {
      return;
    }

    state.timer = this.setTimer(() => {
      state.timer = null;
      void this.drainPaneQueue(paneIndex);
    }, delayMs);
  }

  private clearPaneQueueTimer(state: PaneQueueState): void {
    if (state.timer === null) {
      return;
    }

    this.clearTimer(state.timer);
    state.timer = null;
  }

  private clearPaneQueueState(paneIndex: number, state: PaneQueueState): void {
    this.clearPaneQueueTimer(state);
    state.queuedPromptText = null;
    state.queueStartedAtMs = null;
    state.idleStreak = 0;
    this.maybeCleanupPaneQueueState(paneIndex, state);
  }

  private maybeCleanupPaneQueueState(paneIndex: number, state: PaneQueueState): void {
    if (state.drainInProgress) {
      return;
    }

    if (state.queuedPromptText !== null || state.timer !== null) {
      return;
    }

    this.paneQueueStates.delete(paneIndex);
  }

  private async drainPaneQueue(paneIndex: number): Promise<void> {
    const state = this.getPaneQueueState(paneIndex);
    if (state.drainInProgress || state.queuedPromptText === null) {
      this.maybeCleanupPaneQueueState(paneIndex, state);
      return;
    }

    state.drainInProgress = true;
    try {
      const pane = this.findPaneTargetByIndex(paneIndex);
      if (!pane) {
        this.clearPaneQueueState(paneIndex, state);
        return;
      }

      const injectRuntimeScript = this.getInjectRuntimeScript();
      if (!injectRuntimeScript) {
        const queuedPrompt = state.queuedPromptText;
        this.clearPaneQueueState(paneIndex, state);
        if (queuedPrompt !== null) {
          this.onQueuedDispatchFailure(
            paneIndex,
            queuedPrompt,
            [`pane-${paneIndex}: inject runtime not available`]
          );
        }
        return;
      }

      const waitedMs = state.queueStartedAtMs === null ? 0 : this.now() - state.queueStartedAtMs;
      if (waitedMs > this.queueMaxWaitMs) {
        const queuedPrompt = state.queuedPromptText;
        this.clearPaneQueueState(paneIndex, state);
        if (queuedPrompt !== null) {
          this.onQueueTimeout(paneIndex, queuedPrompt, waitedMs);
        }
        return;
      }

      const statusEvalScript = buildPromptStatusEvalScript();
      const busyState = await this.detectPaneBusyState(
        pane,
        injectRuntimeScript,
        statusEvalScript
      );
      if (busyState !== 'idle') {
        state.idleStreak = 0;
        this.schedulePaneQueueDrain(paneIndex, state);
        return;
      }

      state.idleStreak += 1;
      if (state.idleStreak < this.queueIdleConfirmations) {
        this.schedulePaneQueueDrain(paneIndex, state);
        return;
      }

      const promptText = state.queuedPromptText;
      state.queuedPromptText = null;
      state.queueStartedAtMs = null;
      state.idleStreak = 0;

      if (promptText === null) {
        return;
      }

      let promptEvalScript: string;
      try {
        promptEvalScript = buildPromptInjectionEvalScript(promptText);
      } catch (error) {
        this.onQueuedDispatchFailure(paneIndex, promptText, [
          `invalid-queued-prompt: ${toFailureReason(error)}`,
        ]);
        return;
      }

      const executionResult = await this.executePromptEvalScriptOnPane(
        pane,
        injectRuntimeScript,
        promptEvalScript
      );

      if (!executionResult.success) {
        this.onQueuedDispatchFailure(
          paneIndex,
          promptText,
          [`pane-${paneIndex}: ${executionResult.reason ?? 'prompt injection failed'}`]
        );
      } else {
        this.markPanePostSubmitGuard(paneIndex);
      }
    } catch (error) {
      console.error('[PromptDispatchService] Unexpected error while draining pane queue:', {
        paneIndex,
        error,
      });
    } finally {
      state.drainInProgress = false;
      if (state.queuedPromptText !== null) {
        if (state.queueStartedAtMs === null) {
          state.queueStartedAtMs = this.now();
        }
        this.schedulePaneQueueDrain(paneIndex, state);
      } else {
        this.maybeCleanupPaneQueueState(paneIndex, state);
      }
    }
  }
}
