import { describe, expect, it } from 'vitest';
import {
  CANONICAL_PROVIDERS,
  DEFAULT_CONFIG,
  normalizeConfig,
  normalizePaneCount,
} from './configNormalization';

describe('normalizePaneCount', () => {
  it('falls back to defaults for non-integer values', () => {
    expect(normalizePaneCount(undefined)).toBe(DEFAULT_CONFIG.defaults.pane_count);
    expect(normalizePaneCount(2.5)).toBe(DEFAULT_CONFIG.defaults.pane_count);
    expect(normalizePaneCount('2')).toBe(DEFAULT_CONFIG.defaults.pane_count);
  });

  it('clamps pane count into supported range', () => {
    expect(normalizePaneCount(0)).toBe(1);
    expect(normalizePaneCount(2)).toBe(2);
    expect(normalizePaneCount(9)).toBe(4);
  });
});

describe('normalizeConfig', () => {
  it('normalizes pane providers and replaces invalid provider keys', () => {
    const normalized = normalizeConfig({
      defaults: {
        pane_count: 3,
        providers: ['gemini', 'unknown-provider', 'claude'],
      },
    });

    expect(normalized.defaults.pane_count).toBe(3);
    expect(normalized.defaults.providers).toEqual(['gemini', 'chatgpt', 'claude']);
    expect(normalized.providers).toEqual(CANONICAL_PROVIDERS);
  });

  it('pads missing providers using fallback provider', () => {
    const normalized = normalizeConfig({
      defaults: {
        pane_count: 4,
        providers: ['claude'],
      },
    });

    expect(normalized.defaults.providers).toEqual(['claude', 'chatgpt', 'chatgpt', 'chatgpt']);
  });

  it('clamps sidebar widths and keeps collapsed width <= expanded width', () => {
    const normalized = normalizeConfig({
      sidebar: {
        expanded_width: 30,
        collapsed_width: 120,
      },
      defaults: {
        pane_count: 2,
        providers: ['chatgpt', 'claude'],
      },
    });

    expect(normalized.sidebar.expanded_width).toBe(40);
    expect(normalized.sidebar.collapsed_width).toBe(40);
  });

  it('handles missing config by returning defaults and canonical providers', () => {
    const normalized = normalizeConfig(undefined);

    expect(normalized.defaults).toEqual({
      pane_count: 3,
      providers: ['chatgpt', 'chatgpt', 'chatgpt'],
    });
    expect(normalized.providers).toEqual(CANONICAL_PROVIDERS);
  });
});
