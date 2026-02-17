import { afterEach, describe, expect, it, vi } from 'vitest';
import { scheduleAutoSubmit } from './auto-submit';

describe('scheduleAutoSubmit', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('retries until submit succeeds', () => {
    vi.useFakeTimers();

    const submitAttempt = vi
      .fn()
      .mockReturnValueOnce({ success: false, reason: 'Button disabled' })
      .mockReturnValueOnce({ success: false, reason: 'Button disabled' })
      .mockReturnValueOnce({ success: true });
    const onRetryExhausted = vi.fn();

    scheduleAutoSubmit(submitAttempt, onRetryExhausted, {
      initialDelayMs: 100,
      retryIntervalMs: 50,
      timeoutMs: 1000,
    });

    vi.advanceTimersByTime(99);
    expect(submitAttempt).toHaveBeenCalledTimes(0);

    vi.advanceTimersByTime(1);
    expect(submitAttempt).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(50);
    expect(submitAttempt).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(50);
    expect(submitAttempt).toHaveBeenCalledTimes(3);

    vi.advanceTimersByTime(500);
    expect(submitAttempt).toHaveBeenCalledTimes(3);
    expect(onRetryExhausted).not.toHaveBeenCalled();
  });

  it('reports retry exhaustion when submit never succeeds', () => {
    vi.useFakeTimers();

    const submitAttempt = vi.fn(() => ({ success: false, reason: 'No sendable submit button found' }));
    const onRetryExhausted = vi.fn();

    scheduleAutoSubmit(submitAttempt, onRetryExhausted, {
      initialDelayMs: 100,
      retryIntervalMs: 80,
      timeoutMs: 250,
    });

    vi.advanceTimersByTime(350);

    expect(submitAttempt).toHaveBeenCalledTimes(3);
    expect(onRetryExhausted).toHaveBeenCalledTimes(1);
    expect(onRetryExhausted).toHaveBeenCalledWith({
      attempts: 3,
      lastReason: 'No sendable submit button found',
    });
  });
});

