export const ABORTED_LOAD_ERROR_CODE = -3;

export interface PaneRecoveryState {
  targetUrl: string;
  attemptCount: number;
}

export interface PaneRecoveryDecisionInput {
  isMainFrame: boolean;
  errorCode: number;
  failedUrl: string;
  targetUrl: string;
  maxRetries: number;
  previousState?: PaneRecoveryState;
}

export type PaneRecoveryDecision =
  | { action: 'ignore' }
  | { action: 'retry'; state: PaneRecoveryState }
  | { action: 'show-error'; state: PaneRecoveryState };

function hasSameOrigin(left: string, right: string): boolean {
  if (!left || !right) {
    return true;
  }
  if (left === right) {
    return true;
  }
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
}

export function decidePaneLoadRecovery(input: PaneRecoveryDecisionInput): PaneRecoveryDecision {
  if (!input.isMainFrame) {
    return { action: 'ignore' };
  }

  if (input.errorCode === ABORTED_LOAD_ERROR_CODE) {
    return { action: 'ignore' };
  }

  const targetUrl = input.targetUrl.trim();
  if (!targetUrl) {
    return { action: 'ignore' };
  }

  if (!hasSameOrigin(input.failedUrl, targetUrl)) {
    return { action: 'ignore' };
  }

  const maxRetries = Math.max(0, Math.floor(input.maxRetries));
  const previous = input.previousState;
  const baseAttemptCount =
    previous && previous.targetUrl === targetUrl
      ? Math.max(0, Math.floor(previous.attemptCount))
      : 0;
  const state: PaneRecoveryState = {
    targetUrl,
    attemptCount: baseAttemptCount + 1,
  };

  if (state.attemptCount <= maxRetries) {
    return { action: 'retry', state };
  }

  return { action: 'show-error', state };
}
