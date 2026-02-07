import { describe, expect, it } from 'vitest';
import { normalizePaneUserAgent } from './paneRuntimePreferences.js';

describe('normalizePaneUserAgent', () => {
  it('strips Electron and app tokens while preserving Chrome tokens', () => {
    const rawUA = 'Mozilla/5.0 Chrome/130.0.6723.191 Electron/33.4.11 Safari/537.36 lazy-llm/0.1.0';
    const normalized = normalizePaneUserAgent(rawUA);

    expect(normalized).toContain('Chrome/130.0.6723.191');
    expect(normalized).toContain('Safari/537.36');
    expect(normalized).not.toContain('Electron/33.4.11');
    expect(normalized).not.toContain('lazy-llm/0.1.0');
  });

  it('keeps user agent unchanged when no removable tokens are present', () => {
    const rawUA = 'Mozilla/5.0 AppleWebKit/537.36 Chrome/130.0.6723.191 Safari/537.36';
    const normalized = normalizePaneUserAgent(rawUA);

    expect(normalized).toBe(rawUA);
  });

  it('falls back to raw user agent if normalization would empty the string', () => {
    const rawUA = 'Electron/33.4.11 lazy-llm/0.1.0';
    const normalized = normalizePaneUserAgent(rawUA);

    expect(normalized).toBe(rawUA);
  });
});
