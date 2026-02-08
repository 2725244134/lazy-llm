import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  DEFAULT_RUNTIME_PREFERENCES,
  ensureExternalConfigFile,
  getExternalConfigPath,
  getExternalDefaultConfigPath,
  mergeRuntimePreferencesWithExternal,
  mergeAppConfigWithExternal,
  normalizeRuntimePreferences,
  readExternalConfigFile,
  type ExternalConfigFile,
} from './externalConfig';
import { DEFAULT_CONFIG } from './configNormalization';
import { APP_CONFIG } from '../../src/config/app';
import { buildDefaultPaneProviders } from './providerConfig';

describe('externalConfig', () => {
  let previousXdgConfigHome: string | undefined;
  let tempConfigHome: string;

  beforeEach(() => {
    previousXdgConfigHome = process.env.XDG_CONFIG_HOME;
    tempConfigHome = mkdtempSync(join(tmpdir(), 'lazy-llm-config-test-'));
    process.env.XDG_CONFIG_HOME = tempConfigHome;
  });

  afterEach(() => {
    if (previousXdgConfigHome === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = previousXdgConfigHome;
    }
    rmSync(tempConfigHome, { recursive: true, force: true });
  });

  it('creates external config files with inherit template and concrete defaults', () => {
    const configPath = ensureExternalConfigFile();
    const defaultConfigPath = getExternalDefaultConfigPath();

    expect(existsSync(configPath)).toBe(true);
    expect(existsSync(defaultConfigPath)).toBe(true);

    const template = JSON.parse(readFileSync(configPath, 'utf8'));
    expect(template).toEqual({
      sidebar: {
        expanded_width: 'default',
      },
      defaults: {
        pane_count: 'default',
        providers: 'default',
      },
      runtime: {
        zoom: {
          pane_factor: 'default',
          sidebar_factor: 'default',
        },
      },
    });

    const paneCount = APP_CONFIG.layout.pane.defaultCount;
    const providers = buildDefaultPaneProviders(paneCount);

    const concreteDefaults = JSON.parse(readFileSync(defaultConfigPath, 'utf8'));
    expect(concreteDefaults).toEqual({
      sidebar: {
        expanded_width: APP_CONFIG.layout.sidebar.defaultExpandedWidth,
      },
      defaults: {
        pane_count: paneCount,
        providers,
      },
      runtime: {
        zoom: {
          pane_factor: APP_CONFIG.runtime.zoom.paneDefaultFactor,
          sidebar_factor: APP_CONFIG.runtime.zoom.sidebarDefaultFactor,
        },
      },
    });

    writeFileSync(defaultConfigPath, `${JSON.stringify({ sidebar: { expanded_width: 999 } }, null, 2)}\n`, 'utf8');
    ensureExternalConfigFile();
    const refreshedDefaults = JSON.parse(readFileSync(defaultConfigPath, 'utf8'));
    expect(refreshedDefaults).toEqual(concreteDefaults);
  });

  it('merges supported external overrides into app config', () => {
    const externalConfig: ExternalConfigFile = {
      sidebar: { expanded_width: 260 },
      defaults: { pane_count: 4, providers: ['claude', 'chatgpt', 'gemini', 'grok'] },
    };

    const merged = mergeAppConfigWithExternal(DEFAULT_CONFIG, externalConfig);

    expect(merged.sidebar.expanded_width).toBe(260);
    expect(merged.defaults.pane_count).toBe(4);
    expect(merged.defaults.providers).toEqual(['claude', 'chatgpt', 'gemini', 'grok']);
  });

  it('treats default sentinel as no app config override', () => {
    const externalConfig: ExternalConfigFile = {
      sidebar: { expanded_width: 'default' },
      defaults: { pane_count: 'default', providers: 'default' },
    };

    const merged = mergeAppConfigWithExternal(DEFAULT_CONFIG, externalConfig);

    expect(merged.sidebar.expanded_width).toBe(DEFAULT_CONFIG.sidebar.expanded_width);
    expect(merged.defaults.pane_count).toBe(DEFAULT_CONFIG.defaults.pane_count);
    expect(merged.defaults.providers).toEqual(DEFAULT_CONFIG.defaults.providers);
  });

  it('merges runtime zoom using external values and clamps bounds', () => {
    const prefs = mergeRuntimePreferencesWithExternal(DEFAULT_RUNTIME_PREFERENCES, {
      runtime: {
        zoom: {
          pane_factor: 99,
          sidebar_factor: 0.1,
        },
      },
    });

    expect(prefs.paneZoomFactor).toBe(3);
    expect(prefs.sidebarZoomFactor).toBe(0.25);
  });

  it('falls back to base runtime preferences when external zoom fields are missing', () => {
    const base = {
      paneZoomFactor: 1.2,
      sidebarZoomFactor: 1.1,
    };
    const merged = mergeRuntimePreferencesWithExternal(base, {
      runtime: {
        zoom: {
          pane_factor: 0.8,
        },
      },
    });

    expect(merged.paneZoomFactor).toBe(0.8);
    expect(merged.sidebarZoomFactor).toBe(1.1);
  });

  it('treats default sentinel as no runtime preference override', () => {
    const merged = mergeRuntimePreferencesWithExternal(
      {
        paneZoomFactor: 1.18,
        sidebarZoomFactor: 1.07,
      },
      {
        runtime: {
          zoom: {
            pane_factor: 'default',
            sidebar_factor: 'default',
          },
        },
      }
    );

    expect(merged.paneZoomFactor).toBe(1.18);
    expect(merged.sidebarZoomFactor).toBe(1.07);
  });

  it('normalizes stored runtime preferences with fallback', () => {
    const normalized = normalizeRuntimePreferences(
      { paneZoomFactor: Number.NaN, sidebarZoomFactor: 9 },
      { paneZoomFactor: 1.4, sidebarZoomFactor: 1.2 }
    );

    expect(normalized.paneZoomFactor).toBe(1.4);
    expect(normalized.sidebarZoomFactor).toBe(3);
  });

  it('returns null for invalid external config json', () => {
    const configPath = getExternalConfigPath();
    ensureExternalConfigFile();
    writeFileSync(configPath, '{ invalid-json', 'utf8');

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const parsed = readExternalConfigFile();
    errorSpy.mockRestore();
    expect(parsed).toBeNull();
  });
});
