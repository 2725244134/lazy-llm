interface SubmitAttemptResult {
  success: boolean;
  reason?: string;
}

interface AutoSubmitPolicy {
  initialDelayMs: number;
  retryIntervalMs: number;
  timeoutMs: number;
}

type SubmitAttempt = () => SubmitAttemptResult;
type RetryExhaustedCallback = (context: { attempts: number; lastReason?: string }) => void;

const DEFAULT_POLICY: AutoSubmitPolicy = {
  initialDelayMs: 300,
  retryIntervalMs: 180,
  timeoutMs: 4000,
};

export function scheduleAutoSubmit(
  submitAttempt: SubmitAttempt,
  onRetryExhausted?: RetryExhaustedCallback,
  policy: AutoSubmitPolicy = DEFAULT_POLICY
): void {
  const deadlineMs = Date.now() + policy.timeoutMs;
  let attempts = 0;
  let lastReason: string | undefined;

  const attempt = () => {
    attempts += 1;
    const result = submitAttempt();
    if (result.success) {
      return;
    }

    lastReason = result.reason;
    if (Date.now() >= deadlineMs) {
      onRetryExhausted?.({ attempts, lastReason });
      return;
    }

    setTimeout(attempt, policy.retryIntervalMs);
  };

  setTimeout(attempt, policy.initialDelayMs);
}

