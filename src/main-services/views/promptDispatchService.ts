import type { PromptImagePayload, PromptRequest } from '@shared-contracts/ipc/contracts';
import { normalizePromptImagePayload, validatePromptImagePayload } from '@shared-contracts/ipc/promptImage';
import {
  buildPromptDraftSyncEvalScript,
  buildPromptImageAttachEvalScript,
  buildPromptInjectionEvalScript,
  buildPromptStatusEvalScript,
  buildPromptSubmitEvalScript,
  type PromptImageAttachResult,
  type PromptInjectionResult,
  type PromptStatusEvalResult,
} from './promptInjection.js';

export interface PromptDispatchPaneExecutionTarget {
  paneIndex: number;
  executeJavaScript(script: string, userGesture?: boolean): Promise<unknown>;
  stagePromptImagePayload(image: PromptImagePayload): Promise<void>;
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
  | { kind: 'dispatched'; failures: string[] }
  | { kind: 'queued' }
  | { kind: 'failed'; failure: string };

interface PanePromptDispatchScripts {
  promptEvalScript: string;
  imagePayload: PromptImagePayload | null;
  imageAttachEvalScript: string | null;
  submitEvalScript: string | null;
}

interface NormalizedPromptRequest {
  text: string;
  image: PromptImagePayload | null;
}

interface PaneQueueState {
  queuedPromptRequest: NormalizedPromptRequest | null;
  queueStartedAtMs: number | null;
  idleStreak: number;
  timer: ReturnType<typeof setTimeout> | null;
  drainInProgress: boolean;
}

interface PaneScriptExecutionResult {
  success: boolean;
  reason?: string;
}

interface NormalizationResult<TValue> {
  value: TValue | null;
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

  async sendPromptToAll(input: string | PromptRequest): Promise<PromptDispatchResult> {
    const normalizedRequestResult = this.normalizePromptRequest(input);
    if (!normalizedRequestResult.value) {
      return {
        success: false,
        failures: [normalizedRequestResult.reason ?? 'invalid-prompt'],
      };
    }

    const normalizedRequest = normalizedRequestResult.value;

    let promptScripts: PanePromptDispatchScripts;
    try {
      promptScripts = this.buildPromptDispatchScripts(normalizedRequest);
    } catch (error) {
      const message = toFailureReason(error);
      const prefix = message.includes('prompt image') ? 'invalid-prompt-image' : 'invalid-prompt';
      return {
        success: false,
        failures: [`${prefix}: ${message}`],
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
          normalizedRequest,
          promptScripts,
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
        failures.push(...outcome.failures);
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

  private normalizePromptRequest(input: string | PromptRequest): NormalizationResult<NormalizedPromptRequest> {
    const request = typeof input === 'string' ? { text: input } : input;
    const text = typeof request?.text === 'string' ? request.text : '';
    const normalizedText = text.trim();
    if (!normalizedText) {
      return {
        value: null,
        reason: 'invalid-prompt: prompt text cannot be empty',
      };
    }

    const normalizedImageResult = this.normalizePromptImage(request?.image);
    if (!normalizedImageResult.value && normalizedImageResult.reason) {
      return {
        value: null,
        reason: `invalid-prompt-image: ${normalizedImageResult.reason}`,
      };
    }

    return {
      value: {
        text: normalizedText,
        image: normalizedImageResult.value,
      },
    };
  }

  private normalizePromptImage(
    image: PromptRequest['image']
  ): NormalizationResult<PromptImagePayload | null> {
    if (image === undefined || image === null) {
      return { value: null };
    }

    const normalized = normalizePromptImagePayload(image);
    if (!normalized) {
      const validation = validatePromptImagePayload(image);
      return {
        value: null,
        reason: validation.ok ? undefined : validation.reason,
      };
    }

    return {
      value: normalized,
    };
  }

  private buildPromptDispatchScripts(request: NormalizedPromptRequest): PanePromptDispatchScripts {
    const hasImage = request.image !== null;
    const promptEvalScript = buildPromptInjectionEvalScript(request.text, {
      autoSubmit: !hasImage,
    });
    const submitEvalScript = hasImage ? buildPromptSubmitEvalScript() : null;
    const imageAttachEvalScript = hasImage
      ? buildPromptImageAttachEvalScript()
      : null;

    return {
      promptEvalScript,
      imagePayload: request.image,
      imageAttachEvalScript,
      submitEvalScript,
    };
  }

  private async dispatchPromptToPane(
    pane: PromptDispatchPaneExecutionTarget,
    request: NormalizedPromptRequest,
    promptScripts: PanePromptDispatchScripts,
    injectRuntimeScript: string,
    statusEvalScript: string
  ): Promise<PanePromptDispatchOutcome> {
    const busyState = await this.detectPaneBusyState(
      pane,
      injectRuntimeScript,
      statusEvalScript
    );

    if (busyState !== 'idle') {
      this.queueLatestPromptForPane(pane.paneIndex, request);
      return { kind: 'queued' };
    }

    const executionResult = await this.executePromptDispatchOnPane(
      pane,
      injectRuntimeScript,
      promptScripts
    );

    if (!executionResult.success) {
      return {
        kind: 'failed',
        failure: `pane-${pane.paneIndex}: ${executionResult.reason ?? 'prompt injection failed'}`,
      };
    }

    this.markPanePostSubmitGuard(pane.paneIndex);
    return {
      kind: 'dispatched',
      failures: executionResult.nonBlockingFailures,
    };
  }

  private async executePromptDispatchOnPane(
    pane: PromptDispatchPaneExecutionTarget,
    injectRuntimeScript: string,
    promptScripts: PanePromptDispatchScripts
  ): Promise<{ success: boolean; reason?: string; nonBlockingFailures: string[] }> {
    const nonBlockingFailures: string[] = [];

    const promptInjectionResult = await this.executePromptEvalScriptOnPane(
      pane,
      injectRuntimeScript,
      promptScripts.promptEvalScript
    );
    if (!promptInjectionResult.success) {
      return {
        success: false,
        reason: promptInjectionResult.reason ?? 'prompt injection failed',
        nonBlockingFailures,
      };
    }

    if (promptScripts.imagePayload && promptScripts.imageAttachEvalScript) {
      let imageStaged = false;
      try {
        await pane.stagePromptImagePayload(promptScripts.imagePayload);
        imageStaged = true;
      } catch (error) {
        nonBlockingFailures.push(
          `pane-${pane.paneIndex}: image attach failed (${toFailureReason(error)})`
        );
      }

      if (imageStaged) {
        const imageAttachResult = await this.executePromptEvalScriptOnPane(
          pane,
          injectRuntimeScript,
          promptScripts.imageAttachEvalScript,
          'prompt image attachment failed'
        );
        if (!imageAttachResult.success) {
          nonBlockingFailures.push(
            `pane-${pane.paneIndex}: image attach failed (${imageAttachResult.reason ?? 'unknown reason'})`
          );
        }
      }
    }

    if (promptScripts.submitEvalScript) {
      const submitResult = await this.executePromptEvalScriptOnPane(
        pane,
        injectRuntimeScript,
        promptScripts.submitEvalScript,
        'prompt submit failed'
      );
      if (!submitResult.success) {
        return {
          success: false,
          reason: submitResult.reason ?? 'prompt submit failed',
          nonBlockingFailures,
        };
      }
    }

    return {
      success: true,
      nonBlockingFailures,
    };
  }

  private async executePromptEvalScriptOnPane(
    pane: PromptDispatchPaneExecutionTarget,
    injectRuntimeScript: string,
    promptEvalScript: string,
    fallbackReason = 'prompt injection failed'
  ): Promise<PaneScriptExecutionResult> {
    try {
      await pane.executeJavaScript(injectRuntimeScript, true);
      const result = await pane.executeJavaScript(
        promptEvalScript,
        true
      ) as PromptInjectionResult | PromptImageAttachResult | undefined;

      if (result?.success) {
        return { success: true };
      }

      return {
        success: false,
        reason: result?.reason ?? fallbackReason,
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
      queuedPromptRequest: null,
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

  private queueLatestPromptForPane(paneIndex: number, request: NormalizedPromptRequest): void {
    const state = this.getPaneQueueState(paneIndex);
    state.queuedPromptRequest = request;
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
    if (state.timer !== null || state.queuedPromptRequest === null || state.drainInProgress) {
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
    state.queuedPromptRequest = null;
    state.queueStartedAtMs = null;
    state.idleStreak = 0;
    this.maybeCleanupPaneQueueState(paneIndex, state);
  }

  private maybeCleanupPaneQueueState(paneIndex: number, state: PaneQueueState): void {
    if (state.drainInProgress) {
      return;
    }

    if (state.queuedPromptRequest !== null || state.timer !== null) {
      return;
    }

    this.paneQueueStates.delete(paneIndex);
  }

  private async drainPaneQueue(paneIndex: number): Promise<void> {
    const state = this.getPaneQueueState(paneIndex);
    if (state.drainInProgress || state.queuedPromptRequest === null) {
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
        const queuedPrompt = state.queuedPromptRequest;
        this.clearPaneQueueState(paneIndex, state);
        if (queuedPrompt !== null) {
          this.onQueuedDispatchFailure(
            paneIndex,
            queuedPrompt.text,
            [`pane-${paneIndex}: inject runtime not available`]
          );
        }
        return;
      }

      const waitedMs = state.queueStartedAtMs === null ? 0 : this.now() - state.queueStartedAtMs;
      if (waitedMs > this.queueMaxWaitMs) {
        const queuedPrompt = state.queuedPromptRequest;
        this.clearPaneQueueState(paneIndex, state);
        if (queuedPrompt !== null) {
          this.onQueueTimeout(paneIndex, queuedPrompt.text, waitedMs);
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

      const queuedPrompt = state.queuedPromptRequest;
      state.queuedPromptRequest = null;
      state.queueStartedAtMs = null;
      state.idleStreak = 0;

      if (queuedPrompt === null) {
        return;
      }

      let promptScripts: PanePromptDispatchScripts;
      try {
        promptScripts = this.buildPromptDispatchScripts(queuedPrompt);
      } catch (error) {
        this.onQueuedDispatchFailure(paneIndex, queuedPrompt.text, [
          `invalid-queued-prompt: ${toFailureReason(error)}`,
        ]);
        return;
      }

      const executionResult = await this.executePromptDispatchOnPane(
        pane,
        injectRuntimeScript,
        promptScripts
      );

      if (!executionResult.success) {
        this.onQueuedDispatchFailure(
          paneIndex,
          queuedPrompt.text,
          [`pane-${paneIndex}: ${executionResult.reason ?? 'prompt injection failed'}`]
        );
      } else {
        if (executionResult.nonBlockingFailures.length > 0) {
          this.onQueuedDispatchFailure(
            paneIndex,
            queuedPrompt.text,
            executionResult.nonBlockingFailures
          );
        }
        this.markPanePostSubmitGuard(paneIndex);
      }
    } catch (error) {
      console.error('[PromptDispatchService] Unexpected error while draining pane queue:', {
        paneIndex,
        error,
      });
    } finally {
      state.drainInProgress = false;
      if (state.queuedPromptRequest !== null) {
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
