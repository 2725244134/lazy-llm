import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  DEFAULT_RUNTIME_PREFERENCES,
  ensureExternalConfigFile,
  getExternalConfigPath,
  mergeRuntimePreferencesWithExternal,
  mergeAppConfigWithExternal,
  normalizeRuntimePreferences,
  readExternalConfigFile,
  type ExternalConfigFile,
} from './externalConfig';
import { DEFAULT_CONFIG } from './configNormalization';

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

  it('creates an external config file with defaults when missing', () => {
    const configPath = ensureExternalConfigFile();

    expect(existsSync(configPath)).toBe(true);
    const parsed = JSON.parse(readFileSync(configPath, 'utf8'));
    expect(parsed).toEqual({
      sidebar: {},
      defaults: {},
      runtime: {
        zoom: {},
      },
    });
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
