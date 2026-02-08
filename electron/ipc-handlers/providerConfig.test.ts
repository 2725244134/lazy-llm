import { describe, expect, it } from 'vitest';
import { APP_CONFIG } from '../../src/config/app';
import {
  buildDefaultPaneProviders,
  normalizeProviderSequence,
  padProviderSequence,
} from './providerConfig';

describe('providerConfig', () => {
  it('pads provider sequence using the first provider as fallback', () => {
    expect(padProviderSequence(['claude'], 4)).toEqual(['claude', 'claude', 'claude', 'claude']);
  });

  it('builds default pane providers from app defaults', () => {
    const paneCount = APP_CONFIG.layout.pane.defaultCount;
    const fallbackProvider = APP_CONFIG.providers.defaultPaneKeys[0] ?? 'chatgpt';
    const expected = Array.from({ length: paneCount }, (_, paneIndex) => {
      return APP_CONFIG.providers.defaultPaneKeys[paneIndex] ?? fallbackProvider;
    });

    expect(buildDefaultPaneProviders(paneCount)).toEqual(expected);
  });

  it('normalizes provider sequence and replaces invalid entries', () => {
    const normalized = normalizeProviderSequence(['gemini', 'invalid-provider', 'claude'], 3);
    expect(normalized).toEqual(['gemini', 'chatgpt', 'claude']);
  });
});
