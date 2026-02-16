import { describe, expect, it } from 'vitest';
import {
  normalizePromptImagePayload,
  PROMPT_IMAGE_MAX_BYTES,
  validatePromptImagePayload,
} from './promptImage';

describe('validatePromptImagePayload', () => {
  it('accepts valid clipboard image payload', () => {
    const result = validatePromptImagePayload({
      mimeType: 'image/png',
      base64Data: 'QUJD',
      sizeBytes: 3,
      source: 'clipboard',
    });

    expect(result).toEqual({
      ok: true,
      value: {
        mimeType: 'image/png',
        base64Data: 'QUJD',
        sizeBytes: 3,
        source: 'clipboard',
      },
    });
  });

  it('rejects payload larger than max bytes', () => {
    const result = validatePromptImagePayload({
      mimeType: 'image/png',
      base64Data: 'QUJD',
      sizeBytes: PROMPT_IMAGE_MAX_BYTES + 1,
      source: 'clipboard',
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toContain(`(${PROMPT_IMAGE_MAX_BYTES})`);
  });
});

describe('normalizePromptImagePayload', () => {
  it('returns null for invalid payload', () => {
    const normalized = normalizePromptImagePayload({
      mimeType: '',
      base64Data: 'QUJD',
      sizeBytes: 3,
      source: 'clipboard',
    });
    expect(normalized).toBeNull();
  });

  it('returns null when input is absent', () => {
    expect(normalizePromptImagePayload(undefined)).toBeNull();
    expect(normalizePromptImagePayload(null)).toBeNull();
  });
});
