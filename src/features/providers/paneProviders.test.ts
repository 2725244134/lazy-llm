import { describe, expect, it } from 'vitest';
import { APP_CONFIG } from '@/config';
import { normalizePaneProviderSequence } from './paneProviders';

describe('normalizePaneProviderSequence', () => {
  it('uses first valid provider in source as fallback', () => {
    expect(normalizePaneProviderSequence(['claude'], 3)).toEqual([
      'claude',
      'claude',
      'claude',
    ]);
  });

  it('replaces invalid providers with normalized fallback', () => {
    const fallbackProvider = APP_CONFIG.providers.defaultPaneKeys[0] ?? APP_CONFIG.providers.catalog[0]?.key;
    expect(normalizePaneProviderSequence(['not-exist', 'gemini'], 3)).toEqual([
      fallbackProvider ?? 'chatgpt',
      'gemini',
      fallbackProvider ?? 'chatgpt',
    ]);
  });
});
