import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  ensureExternalConfigFile,
  getExternalConfigPath,
  mergeAppConfigWithExternal,
  resolveRuntimePreferences,
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
    expect(parsed.sidebar.expanded_width).toBe(DEFAULT_CONFIG.sidebar.expanded_width);
    expect(parsed.defaults.pane_count).toBe(DEFAULT_CONFIG.defaults.pane_count);
    expect(Array.isArray(parsed.defaults.providers)).toBe(true);
    expect(parsed.defaults.providers).toHaveLength(parsed.defaults.pane_count);
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

  it('resolves runtime zoom preferences with clamping', () => {
    const prefs = resolveRuntimePreferences({
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
