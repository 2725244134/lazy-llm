import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { DEFAULT_CONFIG } from './configNormalization';

let mockStoreState = new Map<string, unknown>();

class MockElectronStore<T extends Record<string, unknown>> {
  constructor(options?: { defaults?: Partial<T> }) {
    mockStoreState = new Map<string, unknown>();
    if (!options?.defaults) {
      return;
    }
    for (const [key, value] of Object.entries(options.defaults)) {
      mockStoreState.set(key, structuredClone(value));
    }
  }

  get<K extends keyof T>(key: K): T[K] {
    return mockStoreState.get(key as string) as T[K];
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    mockStoreState.set(key as string, structuredClone(value));
  }
}

vi.mock('electron-store', () => {
  return { default: MockElectronStore };
});

describe('store config resolution priority', () => {
  let previousXdgConfigHome: string | undefined;
  let tempConfigHome: string;

  beforeEach(() => {
    previousXdgConfigHome = process.env.XDG_CONFIG_HOME;
    tempConfigHome = mkdtempSync(join(tmpdir(), 'lazy-llm-store-test-'));
    process.env.XDG_CONFIG_HOME = tempConfigHome;
    mockStoreState = new Map<string, unknown>();
    vi.resetModules();
  });

  afterEach(() => {
    if (previousXdgConfigHome === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = previousXdgConfigHome;
    }
    rmSync(tempConfigHome, { recursive: true, force: true });
    vi.resetModules();
  });

  it('uses store values when external config does not specify fields', async () => {
    const storeModule = await import('./store');
    const externalConfigModule = await import('./externalConfig');

    storeModule.store.set('config', {
      ...DEFAULT_CONFIG,
      sidebar: {
        ...DEFAULT_CONFIG.sidebar,
        expanded_width: 333,
      },
      provider: {
        ...DEFAULT_CONFIG.provider,
        pane_count: 3,
        panes: ['grok', 'claude', 'gemini'],
      },
    });
    storeModule.store.set('runtimePreferences', {
      paneZoomFactor: 1.25,
      sidebarZoomFactor: 1.15,
    });

    const externalConfigPath = externalConfigModule.ensureExternalConfigFile();
    writeFileSync(
      externalConfigPath,
      `${JSON.stringify({ provider: {}, sidebar: {}, quick_prompt: {}, webview: { zoom: {} } }, null, 2)}\n`,
      'utf8'
    );

    const resolved = storeModule.getResolvedSettings();

    expect(resolved.config.sidebar.expanded_width).toBe(333);
    expect(resolved.config.provider.pane_count).toBe(3);
    expect(resolved.config.provider.panes).toEqual(['grok', 'claude', 'gemini']);
    expect(resolved.runtimePreferences.paneZoomFactor).toBe(1.25);
    expect(resolved.runtimePreferences.sidebarZoomFactor).toBe(1.15);
  });

  it('uses external values as highest priority and falls back to store per field', async () => {
    const storeModule = await import('./store');
    const externalConfigModule = await import('./externalConfig');

    storeModule.store.set('config', {
      ...DEFAULT_CONFIG,
      sidebar: {
        ...DEFAULT_CONFIG.sidebar,
        expanded_width: 280,
      },
      provider: {
        ...DEFAULT_CONFIG.provider,
        pane_count: 3,
        panes: ['grok', 'claude', 'gemini'],
      },
    });
    storeModule.store.set('runtimePreferences', {
      paneZoomFactor: 1.3,
      sidebarZoomFactor: 1.2,
    });

    const externalConfigPath = externalConfigModule.ensureExternalConfigFile();
    writeFileSync(
      externalConfigPath,
      `${JSON.stringify(
        {
          provider: { panes: ['chatgpt', 'chatgpt', 'chatgpt'] },
          sidebar: { expanded_width: 220 },
          webview: { zoom: { pane_factor: 0.9 } },
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const resolved = storeModule.getResolvedSettings();

    expect(resolved.config.sidebar.expanded_width).toBe(220);
    expect(resolved.config.provider.pane_count).toBe(3);
    expect(resolved.config.provider.panes).toEqual(['chatgpt', 'chatgpt', 'chatgpt']);
    expect(resolved.runtimePreferences.paneZoomFactor).toBe(0.9);
    expect(resolved.runtimePreferences.sidebarZoomFactor).toBe(1.2);
  });
});
