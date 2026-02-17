import { describe, expect, it } from 'vitest';
import { normalizeProviderSequence, padProviderSequence } from './providerSequence';

describe('padProviderSequence', () => {
  it('pads with the first source provider when available', () => {
    expect(padProviderSequence(['claude'], 4, 'chatgpt')).toEqual([
      'claude',
      'claude',
      'claude',
      'claude',
    ]);
  });

  it('pads with explicit fallback when source is empty', () => {
    expect(padProviderSequence([], 3, 'chatgpt')).toEqual([
      'chatgpt',
      'chatgpt',
      'chatgpt',
    ]);
  });
});

describe('normalizeProviderSequence', () => {
  const providerKeys = ['chatgpt', 'claude', 'gemini'] as const;

  it('replaces invalid providers with global fallback', () => {
    expect(
      normalizeProviderSequence(['gemini', 'unknown', 'claude'], 3, {
        validProviderKeys: providerKeys,
        fallbackProviderKey: 'chatgpt',
      }),
    ).toEqual(['gemini', 'chatgpt', 'claude']);
  });

  it('supports first-valid-source fallback strategy', () => {
    expect(
      normalizeProviderSequence(['claude'], 3, {
        validProviderKeys: providerKeys,
        fallbackProviderKey: 'chatgpt',
        fallbackStrategy: 'first-valid-source',
      }),
    ).toEqual(['claude', 'claude', 'claude']);
  });

  it('falls back to first valid key when fallbackProviderKey is invalid', () => {
    expect(
      normalizeProviderSequence(['unknown'], 2, {
        validProviderKeys: providerKeys,
        fallbackProviderKey: 'not-exist',
      }),
    ).toEqual(['chatgpt', 'chatgpt']);
  });
});
