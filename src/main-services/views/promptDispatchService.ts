import type {
  PromptImagePayload,
  PromptRequest,
  QuickPromptQueueEntry,
  QuickPromptQueueSnapshot,
} from '@shared-contracts/ipc/contracts';
import { normalizePromptImagePayload, validatePromptImagePayload } from '@shared-contracts/ipc/promptImage';
import {
  buildPromptDraftSyncEvalScript,
  buildPromptImageAttachEvalScript,
  buildPromptImageReadyWaitEvalScript,
  buildPromptInjectionEvalScript,
  buildPromptStatusEvalScript,
  buildPromptSubmitEvalScript,
  type PromptImageAttachResult,
  type PromptImageReadyWaitResult,
  type PromptInjectionResult,
  type PromptStatusEvalResult,
} from './promptInjection.js';

export interface PromptDispatchPaneExecutionTarget {
  paneIndex: number;
  executeJavaScript(script: string, userGesture?: boolean): Promise<unknown>;
  stagePromptImagePayload(image: PromptImagePayload): Promise<string>;
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
  onQueueStateChanged?: (snapshot: QuickPromptQueueSnapshot) => void;
  imageReadyWaitTimeoutMs?: number;
  imageReadyPollIntervalMs?: number;
}

const DEFAULT_QUEUE_POLL_INTERVAL_MS = 350;
const DEFAULT_QUEUE_MAX_WAIT_MS = 90_000;
const DEFAULT_QUEUE_IDLE_CONFIRMATIONS = 2;
const DEFAULT_POST_SUBMIT_GUARD_MS = 2_000;
const DEFAULT_IMAGE_READY_WAIT_TIMEOUT_MS = 3_000;
const DEFAULT_IMAGE_READY_POLL_INTERVAL_MS = 120;

type PaneBusyState = 'busy' | 'idle' | 'unknown';

type PanePromptDispatchOutcome =
  | { kind: 'dispatched'; failures: string[] }
  | { kind: 'queued' }
  | { kind: 'failed'; failure: string };

interface PanePromptDispatchScripts {
  promptEvalScript: string;
  imagePayload: PromptImagePayload | null;
  submitEvalScript: string | null;
}

interface NormalizedPromptRequest {
  text: string;
  image: PromptImagePayload | null;
}

interface QueuedPromptItem {
  queueItemId: string;
  roundId: number;
  request: NormalizedPromptRequest;
  queuedAtMs: number;
}

interface PaneQueueState {
  queuedPromptRequests: QueuedPromptItem[];
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

const QUICK_PROMPT_DISPATCH_DEBUG_PREFIX = '[QuickPromptDebug][Dispatch]';

function logQuickPromptDispatchDebug(message: string, details?: Record<string, unknown>): void {
  if (details === undefined) {
    console.info(QUICK_PROMPT_DISPATCH_DEBUG_PREFIX, message);
    return;
  }
  console.info(QUICK_PROMPT_DISPATCH_DEBUG_PREFIX, message, details);
}

function summarizeImagePayload(image: PromptImagePayload | null): Record<string, unknown> {
  if (!image) {
    return {
      hasImage: false,
    };
  }

  return {
    hasImage: true,
    mimeType: image.mimeType,
    sizeBytes: image.sizeBytes,
    source: image.source,
    base64Length: image.base64Data.length,
  };
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
  private readonly onQueueStateChanged: (snapshot: QuickPromptQueueSnapshot) => void;
  private readonly imageReadyWaitTimeoutMs: number;
  private readonly imageReadyPollIntervalMs: number;

  private readonly paneQueueStates = new Map<number, PaneQueueState>();
  private readonly panePostSubmitGuardUntilMs = new Map<number, number>();
  private nextRoundId = 1;
  private nextQueueItemId = 1;

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
    this.onQueueStateChanged = options.onQueueStateChanged ?? (() => {});
    this.imageReadyWaitTimeoutMs = Math.max(
      1,
      Math.floor(options.imageReadyWaitTimeoutMs ?? DEFAULT_IMAGE_READY_WAIT_TIMEOUT_MS)
    );
    this.imageReadyPollIntervalMs = Math.max(
      1,
      Math.floor(options.imageReadyPollIntervalMs ?? DEFAULT_IMAGE_READY_POLL_INTERVAL_MS)
    );
  }

  async sendPromptToAll(input: string | PromptRequest): Promise<PromptDispatchResult> {
    const normalizedRequestResult = this.normalizePromptRequest(input);
    if (!normalizedRequestResult.value) {
      logQuickPromptDispatchDebug('sendPromptToAll rejected invalid normalized request', {
        reason: normalizedRequestResult.reason ?? 'invalid-prompt',
      });
      return {
        success: false,
        failures: [normalizedRequestResult.reason ?? 'invalid-prompt'],
      };
    }

    const normalizedRequest = normalizedRequestResult.value;
    const roundId = this.nextRoundId;
    this.nextRoundId += 1;
    logQuickPromptDispatchDebug('sendPromptToAll accepted request', {
      textLength: normalizedRequest.text.length,
      roundId,
      ...summarizeImagePayload(normalizedRequest.image),
    });

    let promptScripts: PanePromptDispatchScripts;
    try {
      promptScripts = this.buildPromptDispatchScripts(normalizedRequest);
    } catch (error) {
      const message = toFailureReason(error);
      const prefix = message.includes('prompt image') ? 'invalid-prompt-image' : 'invalid-prompt';
      logQuickPromptDispatchDebug('sendPromptToAll failed to build prompt scripts', {
        reason: message,
      });
      return {
        success: false,
        failures: [`${prefix}: ${message}`],
      };
    }

    const paneTargets = this.getPaneTargets();
    const injectRuntimeScript = this.getInjectRuntimeScript();
    if (!injectRuntimeScript) {
      logQuickPromptDispatchDebug('sendPromptToAll aborted due to missing inject runtime script', {
        paneCount: paneTargets.length,
      });
      return {
        success: false,
        failures: this.buildInjectRuntimeUnavailableFailures(paneTargets),
      };
    }
    logQuickPromptDispatchDebug('sendPromptToAll dispatching to panes', {
      paneCount: paneTargets.length,
      ...summarizeImagePayload(promptScripts.imagePayload),
    });

    const statusEvalScript = buildPromptStatusEvalScript();
    const outcomes = await Promise.all(
      paneTargets.map((pane) =>
        this.dispatchPromptToPane(
          pane,
          normalizedRequest,
          roundId,
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

  async attachPromptImageToAll(image: PromptImagePayload): Promise<PromptDispatchResult> {
    const normalizedImageResult = this.normalizePromptImage(image);
    if (!normalizedImageResult.value) {
      return {
        success: false,
        failures: [
          `invalid-prompt-image: ${normalizedImageResult.reason ?? 'prompt image payload is invalid'}`,
        ],
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

    const imagePayload = normalizedImageResult.value;
    logQuickPromptDispatchDebug('attachPromptImageToAll dispatching image payload', {
      paneCount: paneTargets.length,
      ...summarizeImagePayload(imagePayload),
    });

    const failures: string[] = [];
    let attachedCount = 0;

    await Promise.all(
      paneTargets.map(async (pane) => {
        const result = await this.executePromptImageAttachOnPane(
          pane,
          injectRuntimeScript,
          imagePayload
        );

        if (!result.success) {
          failures.push(
            `pane-${pane.paneIndex}: ${result.reason ?? 'image attach failed (unknown reason)'}`
          );
          return;
        }

        attachedCount += 1;
      })
    );

    return {
      success: attachedCount > 0,
      failures,
    };
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

  removeQueuedPromptItem(queueItemId: string): number {
    const normalizedQueueItemId = queueItemId.trim();
    if (!normalizedQueueItemId) {
      return 0;
    }

    return this.mutateQueuedPrompts((queued) => queued.queueItemId === normalizedQueueItemId);
  }

  removeQueuedPromptRound(roundId: number): number {
    if (!Number.isInteger(roundId) || roundId <= 0) {
      return 0;
    }

    return this.mutateQueuedPrompts((queued) => queued.roundId === roundId);
  }

  clearQueuedPrompts(): number {
    return this.mutateQueuedPrompts(() => true);
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

    return {
      promptEvalScript,
      imagePayload: request.image,
      submitEvalScript,
    };
  }

  private async dispatchPromptToPane(
    pane: PromptDispatchPaneExecutionTarget,
    request: NormalizedPromptRequest,
    roundId: number,
    promptScripts: PanePromptDispatchScripts,
    injectRuntimeScript: string,
    statusEvalScript: string
  ): Promise<PanePromptDispatchOutcome> {
    const busyState = await this.detectPaneBusyState(
      pane,
      injectRuntimeScript,
      statusEvalScript
    );
    logQuickPromptDispatchDebug('pane busy-state evaluated', {
      paneIndex: pane.paneIndex,
      busyState,
    });

    if (busyState !== 'idle') {
      this.enqueuePromptForPane(pane.paneIndex, request, roundId);
      logQuickPromptDispatchDebug('pane queued prompt because pane is not idle', {
        paneIndex: pane.paneIndex,
        busyState,
        roundId,
        textLength: request.text.length,
      });
      return { kind: 'queued' };
    }

    const executionResult = await this.executePromptDispatchOnPane(
      pane,
      injectRuntimeScript,
      promptScripts
    );

    if (!executionResult.success) {
      logQuickPromptDispatchDebug('pane dispatch failed', {
        paneIndex: pane.paneIndex,
        reason: executionResult.reason ?? 'prompt injection failed',
      });
      return {
        kind: 'failed',
        failure: `pane-${pane.paneIndex}: ${executionResult.reason ?? 'prompt injection failed'}`,
      };
    }

    this.markPanePostSubmitGuard(pane.paneIndex);
    logQuickPromptDispatchDebug('pane dispatch completed', {
      paneIndex: pane.paneIndex,
      nonBlockingFailureCount: executionResult.nonBlockingFailures.length,
    });
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
    logQuickPromptDispatchDebug('executePromptDispatchOnPane started', {
      paneIndex: pane.paneIndex,
      hasImage: promptScripts.imagePayload !== null,
    });

    const promptInjectionResult = await this.executePromptEvalScriptOnPane(
      pane,
      injectRuntimeScript,
      promptScripts.promptEvalScript
    );
    if (!promptInjectionResult.success) {
      logQuickPromptDispatchDebug('prompt injection failed', {
        paneIndex: pane.paneIndex,
        reason: promptInjectionResult.reason ?? 'prompt injection failed',
      });
      return {
        success: false,
        reason: promptInjectionResult.reason ?? 'prompt injection failed',
        nonBlockingFailures,
      };
    }
    logQuickPromptDispatchDebug('prompt injection succeeded', {
      paneIndex: pane.paneIndex,
    });

    if (promptScripts.imagePayload) {
      const imageAttachResult = await this.executePromptImageAttachOnPane(
        pane,
        injectRuntimeScript,
        promptScripts.imagePayload
      );
      if (!imageAttachResult.success) {
        nonBlockingFailures.push(
          `pane-${pane.paneIndex}: ${imageAttachResult.reason ?? 'image attach failed (unknown reason)'}`
        );
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
        logQuickPromptDispatchDebug('prompt submit failed', {
          paneIndex: pane.paneIndex,
          reason: submitResult.reason ?? 'prompt submit failed',
        });
        return {
          success: false,
          reason: submitResult.reason ?? 'prompt submit failed',
          nonBlockingFailures,
        };
      }
      logQuickPromptDispatchDebug('prompt submit succeeded', {
        paneIndex: pane.paneIndex,
      });
    }

    logQuickPromptDispatchDebug('executePromptDispatchOnPane finished', {
      paneIndex: pane.paneIndex,
      nonBlockingFailureCount: nonBlockingFailures.length,
    });
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
      ) as PromptInjectionResult | PromptImageAttachResult | PromptImageReadyWaitResult | undefined;

      if (result?.success) {
        return { success: true };
      }

      logQuickPromptDispatchDebug('prompt eval script returned unsuccessful result', {
        paneIndex: pane.paneIndex,
        fallbackReason,
        resultReason: result?.reason ?? null,
      });
      return {
        success: false,
        reason: result?.reason ?? fallbackReason,
      };
    } catch (error) {
      this.onPaneExecutionError(pane.paneIndex, error);
      logQuickPromptDispatchDebug('prompt eval script threw error', {
        paneIndex: pane.paneIndex,
        fallbackReason,
        reason: toFailureReason(error),
      });
      return {
        success: false,
        reason: toFailureReason(error),
      };
    }
  }

  private async executePromptImageAttachOnPane(
    pane: PromptDispatchPaneExecutionTarget,
    injectRuntimeScript: string,
    imagePayload: PromptImagePayload
  ): Promise<PaneScriptExecutionResult> {
    try {
      logQuickPromptDispatchDebug('staging prompt image payload for pane', {
        paneIndex: pane.paneIndex,
        ...summarizeImagePayload(imagePayload),
      });
      const consumeToken = await pane.stagePromptImagePayload(imagePayload);
      logQuickPromptDispatchDebug('prompt image payload staged', {
        paneIndex: pane.paneIndex,
        consumeTokenLength: consumeToken.length,
      });

      const imageAttachEvalScript = buildPromptImageAttachEvalScript(consumeToken);
      const imageAttachResult = await this.executePromptEvalScriptOnPane(
        pane,
        injectRuntimeScript,
        imageAttachEvalScript,
        'prompt image attachment failed'
      );
      if (!imageAttachResult.success) {
        const attachReason = imageAttachResult.reason ?? 'unknown reason';
        logQuickPromptDispatchDebug('prompt image attach failed', {
          paneIndex: pane.paneIndex,
          reason: attachReason,
        });
        return {
          success: false,
          reason: `image attach failed (${attachReason})`,
        };
      }

      logQuickPromptDispatchDebug('prompt image attach succeeded; waiting readiness', {
        paneIndex: pane.paneIndex,
        timeoutMs: this.imageReadyWaitTimeoutMs,
        pollIntervalMs: this.imageReadyPollIntervalMs,
      });
      const imageReadyWaitScript = buildPromptImageReadyWaitEvalScript(
        this.imageReadyWaitTimeoutMs,
        this.imageReadyPollIntervalMs
      );
      const imageReadyWaitResult = await this.executePromptEvalScriptOnPane(
        pane,
        injectRuntimeScript,
        imageReadyWaitScript,
        'prompt image readiness wait failed'
      );
      if (!imageReadyWaitResult.success) {
        const waitReason = imageReadyWaitResult.reason ?? 'unknown reason';
        logQuickPromptDispatchDebug('prompt image readiness wait failed', {
          paneIndex: pane.paneIndex,
          reason: waitReason,
        });
        return {
          success: false,
          reason: `image readiness wait failed (${waitReason})`,
        };
      }

      logQuickPromptDispatchDebug('prompt image readiness wait succeeded', {
        paneIndex: pane.paneIndex,
      });
      return { success: true };
    } catch (error) {
      const failureReason = toFailureReason(error);
      logQuickPromptDispatchDebug('prompt image staging or attachment threw error', {
        paneIndex: pane.paneIndex,
        reason: failureReason,
      });
      return {
        success: false,
        reason: `image attach failed (${failureReason})`,
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

    // Some providers (especially Gemini) can expose stale/missing completion markers.
    // When submit is explicitly available again, we can safely treat pane as idle.
    if (result.canSubmit === true) {
      return 'idle';
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
      queuedPromptRequests: [],
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

  private buildQueueSnapshot(): QuickPromptQueueSnapshot {
    const entries: QuickPromptQueueEntry[] = [];
    const paneQueueEntries = Array.from(this.paneQueueStates.entries())
      .sort(([leftPaneIndex], [rightPaneIndex]) => leftPaneIndex - rightPaneIndex);

    for (const [paneIndex, state] of paneQueueEntries) {
      for (const queued of state.queuedPromptRequests) {
        entries.push({
          queueItemId: queued.queueItemId,
          roundId: queued.roundId,
          paneIndex,
          text: queued.request.text,
          queuedAtMs: queued.queuedAtMs,
        });
      }
    }

    return { entries };
  }

  private notifyQueueStateChanged(): void {
    this.onQueueStateChanged(this.buildQueueSnapshot());
  }

  private enqueuePromptForPane(
    paneIndex: number,
    request: NormalizedPromptRequest,
    roundId: number
  ): void {
    const state = this.getPaneQueueState(paneIndex);
    state.queuedPromptRequests.push({
      queueItemId: `q-${this.nextQueueItemId}`,
      roundId,
      request,
      queuedAtMs: this.now(),
    });
    this.nextQueueItemId += 1;
    state.idleStreak = 0;
    this.notifyQueueStateChanged();
    this.schedulePaneQueueDrain(paneIndex, state);
  }

  private mutateQueuedPrompts(
    shouldRemove: (queued: QueuedPromptItem) => boolean
  ): number {
    const touchedStates = new Map<number, PaneQueueState>();
    let removedCount = 0;

    for (const [paneIndex, state] of this.paneQueueStates.entries()) {
      const retained: QueuedPromptItem[] = [];
      for (const queued of state.queuedPromptRequests) {
        if (shouldRemove(queued)) {
          removedCount += 1;
          continue;
        }
        retained.push(queued);
      }
      if (retained.length === state.queuedPromptRequests.length) {
        continue;
      }

      state.queuedPromptRequests = retained;
      state.idleStreak = 0;
      touchedStates.set(paneIndex, state);
    }

    if (removedCount === 0) {
      return 0;
    }

    for (const [paneIndex, state] of touchedStates.entries()) {
      if (state.queuedPromptRequests.length === 0) {
        this.clearPaneQueueTimer(state);
        this.maybeCleanupPaneQueueState(paneIndex, state);
        continue;
      }

      this.schedulePaneQueueDrain(paneIndex, state);
    }

    this.notifyQueueStateChanged();
    return removedCount;
  }

  private schedulePaneQueueDrain(
    paneIndex: number,
    state: PaneQueueState,
    delayMs = this.queuePollIntervalMs
  ): void {
    if (state.timer !== null || state.queuedPromptRequests.length === 0 || state.drainInProgress) {
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
    const hadQueuedPrompts = state.queuedPromptRequests.length > 0;
    this.clearPaneQueueTimer(state);
    state.queuedPromptRequests = [];
    state.idleStreak = 0;
    if (hadQueuedPrompts) {
      this.notifyQueueStateChanged();
    }
    this.maybeCleanupPaneQueueState(paneIndex, state);
  }

  private maybeCleanupPaneQueueState(paneIndex: number, state: PaneQueueState): void {
    if (state.drainInProgress) {
      return;
    }

    if (state.queuedPromptRequests.length > 0 || state.timer !== null) {
      return;
    }

    this.paneQueueStates.delete(paneIndex);
  }

  private dropExpiredQueuedPrompts(paneIndex: number, state: PaneQueueState): void {
    let droppedAny = false;

    while (state.queuedPromptRequests.length > 0) {
      const nextQueuedPrompt = state.queuedPromptRequests[0];
      if (!nextQueuedPrompt) {
        break;
      }

      const waitedMs = this.now() - nextQueuedPrompt.queuedAtMs;
      if (waitedMs <= this.queueMaxWaitMs) {
        break;
      }

      state.queuedPromptRequests.shift();
      droppedAny = true;
      this.onQueueTimeout(paneIndex, nextQueuedPrompt.request.text, waitedMs);
    }

    if (droppedAny) {
      this.notifyQueueStateChanged();
    }
  }

  private async drainPaneQueue(paneIndex: number): Promise<void> {
    const state = this.getPaneQueueState(paneIndex);
    if (state.drainInProgress || state.queuedPromptRequests.length === 0) {
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
        const queuedPrompts = state.queuedPromptRequests.map((queued) => queued.request);
        this.clearPaneQueueState(paneIndex, state);
        for (const queuedPrompt of queuedPrompts) {
          this.onQueuedDispatchFailure(
            paneIndex,
            queuedPrompt.text,
            [`pane-${paneIndex}: inject runtime not available`]
          );
        }
        return;
      }

      this.dropExpiredQueuedPrompts(paneIndex, state);
      if (state.queuedPromptRequests.length === 0) {
        this.maybeCleanupPaneQueueState(paneIndex, state);
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

      const queuedPrompt = state.queuedPromptRequests.shift() ?? null;
      state.idleStreak = 0;
      if (queuedPrompt !== null) {
        this.notifyQueueStateChanged();
      }

      if (queuedPrompt === null) {
        return;
      }

      let promptScripts: PanePromptDispatchScripts;
      try {
        promptScripts = this.buildPromptDispatchScripts(queuedPrompt.request);
      } catch (error) {
        this.onQueuedDispatchFailure(paneIndex, queuedPrompt.request.text, [
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
          queuedPrompt.request.text,
          [`pane-${paneIndex}: ${executionResult.reason ?? 'prompt injection failed'}`]
        );
      } else {
        if (executionResult.nonBlockingFailures.length > 0) {
          this.onQueuedDispatchFailure(
            paneIndex,
            queuedPrompt.request.text,
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
      if (state.queuedPromptRequests.length > 0) {
        this.schedulePaneQueueDrain(paneIndex, state);
      } else {
        this.maybeCleanupPaneQueueState(paneIndex, state);
      }
    }
  }
}
