import { describe, expect, it } from 'vitest';
import {
  CANONICAL_PROVIDERS,
  DEFAULT_CONFIG,
  normalizeConfig,
  normalizePaneCount,
  normalizeQuickPromptHeight,
} from './configNormalization';
import { APP_CONFIG } from '../../src/config/app';

describe('normalizePaneCount', () => {
  it('falls back to defaults for non-integer values', () => {
    expect(normalizePaneCount(undefined)).toBe(DEFAULT_CONFIG.provider.pane_count);
    expect(normalizePaneCount(2.5)).toBe(DEFAULT_CONFIG.provider.pane_count);
    expect(normalizePaneCount('2')).toBe(DEFAULT_CONFIG.provider.pane_count);
  });

  it('clamps pane count into supported range', () => {
    expect(normalizePaneCount(0)).toBe(1);
    expect(normalizePaneCount(2)).toBe(2);
    expect(normalizePaneCount(9)).toBe(4);
  });
});

describe('normalizeQuickPromptHeight', () => {
  it('falls back to defaults for invalid values and clamps bounds', () => {
    expect(normalizeQuickPromptHeight(undefined)).toBe(DEFAULT_CONFIG.quick_prompt.default_height);
    expect(normalizeQuickPromptHeight(0)).toBe(66);
    expect(normalizeQuickPromptHeight(999)).toBe(320);
  });
});

describe('normalizeConfig', () => {
  it('normalizes pane providers and replaces invalid provider keys', () => {
    const normalized = normalizeConfig({
      provider: {
        pane_count: 3,
        panes: ['gemini', 'unknown-provider', 'claude'],
      },
    });

    expect(normalized.provider.pane_count).toBe(3);
    expect(normalized.provider.panes).toEqual(['gemini', 'chatgpt', 'claude']);
    expect(normalized.provider.catalog).toEqual(CANONICAL_PROVIDERS);
  });

  it('pads missing providers using fallback provider', () => {
    const normalized = normalizeConfig({
      provider: {
        pane_count: 4,
        panes: ['claude'],
      },
    });

    expect(normalized.provider.panes).toEqual(['claude', 'chatgpt', 'chatgpt', 'chatgpt']);
  });

  it('clamps expanded width and keeps collapsed width fixed', () => {
    const normalized = normalizeConfig({
      sidebar: {
        expanded_width: 30,
        collapsed_width: 120,
      },
      provider: {
        pane_count: 2,
        panes: ['chatgpt', 'claude'],
      },
    });

    expect(normalized.sidebar.expanded_width).toBe(40);
    expect(normalized.sidebar.collapsed_width).toBe(40);

    const normalizedWithSmallCollapsed = normalizeConfig({
      sidebar: {
        expanded_width: 280,
        collapsed_width: 24,
      },
      provider: {
        pane_count: 2,
        panes: ['chatgpt', 'claude'],
      },
    });

    expect(normalizedWithSmallCollapsed.sidebar.expanded_width).toBe(280);
    expect(normalizedWithSmallCollapsed.sidebar.collapsed_width).toBe(40);
  });

  it('handles missing config by returning defaults and canonical providers', () => {
    const normalized = normalizeConfig(undefined);
    const fallbackProvider = APP_CONFIG.providers.defaultPaneKeys[0] ?? 'chatgpt';
    const expectedPanes = Array.from(
      { length: APP_CONFIG.layout.pane.defaultCount },
      (_, paneIndex) => APP_CONFIG.providers.defaultPaneKeys[paneIndex] ?? fallbackProvider
    );

    expect(normalized.provider).toEqual({
      pane_count: APP_CONFIG.layout.pane.defaultCount,
      panes: expectedPanes,
      catalog: CANONICAL_PROVIDERS,
    });
    expect(normalized.quick_prompt.default_height).toBe(APP_CONFIG.layout.quickPrompt.defaultHeight);
  });
});
