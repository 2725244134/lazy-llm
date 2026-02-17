import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '@/runtime/sidebar';
import { resolveStartupState, saveUiSettings } from './uiSettings';

const STORAGE_KEY = 'lazyllm.settings.v1';

function createConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    provider: {
      pane_count: 2,
      panes: ['chatgpt', 'claude'],
      catalog: [],
    },
    sidebar: {
      expanded_width: 280,
      collapsed_width: 48,
    },
    quick_prompt: {
      default_height: 74,
    },
    ...overrides,
  };
}

function createWindowWithStorage(initial?: Record<string, string>) {
  const storage = new Map<string, string>(Object.entries(initial ?? {}));
  const localStorage = {
    getItem: vi.fn((key: string) => {
      return storage.get(key) ?? null;
    }),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
    }),
  };
  vi.stubGlobal('window', { localStorage });
  return { localStorage, storage };
}

describe('uiSettings', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('migrates legacy settings into a single tab state', () => {
    createWindowWithStorage({
      [STORAGE_KEY]: JSON.stringify({
        version: 1,
        layout: { paneCount: 3, sidebarWidth: 320 },
        providers: { paneKeys: ['gemini'] },
      }),
    });

    const state = resolveStartupState(createConfig());

    expect(state.sidebarWidth).toBe(320);
    expect(state.tabs).toHaveLength(1);
    expect(state.activeTabId).toBe('tab-1');
    expect(state.tabs[0].paneCount).toBe(3);
    expect(state.tabs[0].paneProviders).toEqual(['gemini', 'gemini', 'gemini']);
  });

  it('restores v2 tabs and active tab id', () => {
    createWindowWithStorage({
      [STORAGE_KEY]: JSON.stringify({
        version: 2,
        layout: { sidebarWidth: 300 },
        tabs: {
          activeTabId: 'tab-2',
          items: [
            { id: 'tab-1', paneCount: 1, paneKeys: ['chatgpt'] },
            { id: 'tab-2', paneCount: 4, paneKeys: ['claude'] },
          ],
        },
      }),
    });

    const state = resolveStartupState(createConfig());

    expect(state.sidebarWidth).toBe(300);
    expect(state.activeTabId).toBe('tab-2');
    expect(state.tabs).toHaveLength(2);
    expect(state.tabs[1].paneCount).toBe(4);
    expect(state.tabs[1].paneProviders).toEqual(['claude', 'claude', 'claude', 'claude']);
  });

  it('writes settings using v2 schema', () => {
    const { localStorage, storage } = createWindowWithStorage();

    saveUiSettings({
      version: 2,
      layout: { sidebarWidth: 310 },
      tabs: {
        activeTabId: 'tab-2',
        items: [
          { id: 'tab-1', paneCount: 2, paneKeys: ['chatgpt', 'claude'] },
          { id: 'tab-2', paneCount: 1, paneKeys: ['gemini'] },
        ],
      },
    });

    expect(localStorage.setItem).toHaveBeenCalledOnce();
    const persistedRaw = storage.get(STORAGE_KEY);
    expect(persistedRaw).toBeTruthy();
    const persisted = JSON.parse(persistedRaw ?? '{}') as { version?: number; tabs?: { activeTabId?: string } };
    expect(persisted.version).toBe(2);
    expect(persisted.tabs?.activeTabId).toBe('tab-2');
  });
});
