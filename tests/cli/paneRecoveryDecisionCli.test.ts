import { describe, expect, it } from 'vitest';
import { decidePaneLoadRecovery } from '../../src/main-services/views/paneRecovery';
import { runCliScript } from './cliTestUtils';

const SCRIPT_PATH = 'scripts/lib/paneRecoveryDecisionCli.ts';

describe('paneRecoveryDecisionCli', () => {
  it('prints recovery decision JSON for valid input', () => {
    const input = {
      isMainFrame: true,
      errorCode: -105,
      failedUrl: 'https://grok.com/login',
      targetUrl: 'https://grok.com/',
      maxRetries: 2,
      previousState: {
        targetUrl: 'https://grok.com/',
        attemptCount: 1,
      },
    };

    const result = runCliScript(SCRIPT_PATH, input);
    const output = JSON.parse(result.stdout) as Record<string, unknown>;

    expect(result.status).toBe(0);
    expect(output).toEqual(decidePaneLoadRecovery(input));
  });

  it('returns non-zero with error JSON for malformed JSON input', () => {
    const result = runCliScript(SCRIPT_PATH, '{');
    const output = JSON.parse(result.stdout) as Record<string, unknown>;

    expect(result.status).not.toBe(0);
    expect(output).toMatchObject({ error: expect.any(String) });
  });

  it('returns non-zero with error JSON for invalid shape input', () => {
    const result = runCliScript(SCRIPT_PATH, { isMainFrame: true });
    const output = JSON.parse(result.stdout) as Record<string, unknown>;

    expect(result.status).not.toBe(0);
    expect(output).toMatchObject({ error: expect.any(String) });
  });
});
