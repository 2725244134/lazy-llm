import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from './configNormalization';
import {
  getResolvedSettings,
  resetStoreStateForTests,
  setDefaultPaneCount,
  setDefaultProvider,
  store,
} from './store';

describe('store runtime settings', () => {
  beforeEach(() => {
    resetStoreStateForTests();
  });

  it('returns in-memory config and runtime preferences without external overrides', () => {
    store.set('config', {
      ...DEFAULT_CONFIG,
      provider: {
        ...DEFAULT_CONFIG.provider,
        pane_count: 2,
        panes: ['grok', 'claude'],
      },
      sidebar: {
        ...DEFAULT_CONFIG.sidebar,
        expanded_width: 280,
      },
    });

    store.set('runtimePreferences', {
      paneZoomFactor: 1.15,
      sidebarZoomFactor: 1.05,
    });

    const resolved = getResolvedSettings();

    expect(resolved.config.provider.pane_count).toBe(2);
    expect(resolved.config.provider.panes).toEqual(['grok', 'claude']);
    expect(resolved.config.sidebar.expanded_width).toBe(280);
    expect(resolved.runtimePreferences).toEqual({
      paneZoomFactor: 1.15,
      sidebarZoomFactor: 1.05,
    });
  });

  it('setDefaultPaneCount updates pane count and pads provider sequence', () => {
    store.set('config', {
      ...DEFAULT_CONFIG,
      provider: {
        ...DEFAULT_CONFIG.provider,
        pane_count: 1,
        panes: ['gemini'],
      },
    });

    const next = setDefaultPaneCount(3);

    expect(next.provider.pane_count).toBe(3);
    expect(next.provider.panes).toEqual(['gemini', 'gemini', 'gemini']);
  });

  it('setDefaultProvider updates target pane provider', () => {
    store.set('config', {
      ...DEFAULT_CONFIG,
      provider: {
        ...DEFAULT_CONFIG.provider,
        pane_count: 3,
        panes: ['chatgpt', 'claude', 'gemini'],
      },
    });

    const next = setDefaultProvider(1, 'grok');

    expect(next.provider.panes).toEqual(['chatgpt', 'grok', 'gemini']);
  });
});
