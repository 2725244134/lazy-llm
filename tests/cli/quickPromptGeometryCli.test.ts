import { describe, expect, it } from 'vitest';
import { calculateQuickPromptBounds } from '../../src/main-services/views/quickPromptGeometry';
import { runCliScript } from './cliTestUtils';

const SCRIPT_PATH = 'scripts/lib/quickPromptGeometryCli.ts';

describe('quickPromptGeometryCli', () => {
  it('prints geometry bounds JSON for valid input', () => {
    const input = {
      viewport: { width: 1400, height: 900 },
      anchor: { x: 653, y: 0, width: 373, height: 900 },
      requestedHeight: 74,
      passthroughMode: true,
      minWidth: 280,
      maxWidth: 560,
      minHeight: 66,
      maxHeight: 320,
      viewportPadding: 16,
    };

    const result = runCliScript(SCRIPT_PATH, input);
    const output = JSON.parse(result.stdout) as Record<string, unknown>;

    expect(result.status).toBe(0);
    expect(output).toEqual(calculateQuickPromptBounds(input));
  });

  it('returns non-zero with error JSON for malformed JSON input', () => {
    const result = runCliScript(SCRIPT_PATH, '{"viewport":');
    const output = JSON.parse(result.stdout) as Record<string, unknown>;

    expect(result.status).not.toBe(0);
    expect(output).toMatchObject({ error: expect.any(String) });
  });

  it('returns non-zero with error JSON for invalid shape input', () => {
    const result = runCliScript(SCRIPT_PATH, { viewport: { width: 1 } });
    const output = JSON.parse(result.stdout) as Record<string, unknown>;

    expect(result.status).not.toBe(0);
    expect(output).toMatchObject({ error: expect.any(String) });
  });
});
