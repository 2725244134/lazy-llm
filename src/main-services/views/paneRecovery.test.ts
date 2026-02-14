import { describe, expect, it } from 'vitest';
import { ABORTED_LOAD_ERROR_CODE, decidePaneLoadRecovery } from './paneRecovery';

describe('decidePaneLoadRecovery', () => {
  it('ignores non-main-frame failures', () => {
    const decision = decidePaneLoadRecovery({
      isMainFrame: false,
      errorCode: -105,
      failedUrl: 'https://grok.com/',
      targetUrl: 'https://grok.com/',
      maxRetries: 2,
    });

    expect(decision).toEqual({ action: 'ignore' });
  });

  it('ignores aborted navigation failures', () => {
    const decision = decidePaneLoadRecovery({
      isMainFrame: true,
      errorCode: ABORTED_LOAD_ERROR_CODE,
      failedUrl: 'https://grok.com/',
      targetUrl: 'https://grok.com/',
      maxRetries: 2,
    });

    expect(decision).toEqual({ action: 'ignore' });
  });

  it('retries until max retries are exhausted', () => {
    const firstAttempt = decidePaneLoadRecovery({
      isMainFrame: true,
      errorCode: -105,
      failedUrl: 'https://grok.com/',
      targetUrl: 'https://grok.com/',
      maxRetries: 2,
    });
    const secondAttempt =
      firstAttempt.action === 'retry'
        ? decidePaneLoadRecovery({
            isMainFrame: true,
            errorCode: -105,
            failedUrl: 'https://grok.com/login',
            targetUrl: 'https://grok.com/',
            maxRetries: 2,
            previousState: firstAttempt.state,
          })
        : firstAttempt;
    const thirdAttempt =
      secondAttempt.action === 'retry'
        ? decidePaneLoadRecovery({
            isMainFrame: true,
            errorCode: -105,
            failedUrl: 'https://grok.com/',
            targetUrl: 'https://grok.com/',
            maxRetries: 2,
            previousState: secondAttempt.state,
          })
        : secondAttempt;

    expect(firstAttempt).toMatchObject({ action: 'retry', state: { attemptCount: 1 } });
    expect(secondAttempt).toMatchObject({ action: 'retry', state: { attemptCount: 2 } });
    expect(thirdAttempt).toMatchObject({ action: 'show-error', state: { attemptCount: 3 } });
  });

  it('ignores stale failures from a different origin', () => {
    const decision = decidePaneLoadRecovery({
      isMainFrame: true,
      errorCode: -105,
      failedUrl: 'https://chatgpt.com/',
      targetUrl: 'https://grok.com/',
      maxRetries: 2,
    });

    expect(decision).toEqual({ action: 'ignore' });
  });
});
