import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { AppConfig } from '../ipc/contracts.js';
import { APP_CONFIG } from '../../src/config/app.js';
import { buildDefaultPaneProviders } from './providerConfig.js';

export interface ExternalConfigFile {
  sidebar?: {
    expanded_width?: number | 'default';
  };
  defaults?: {
    pane_count?: number | 'default';
    providers?: string[] | 'default';
  };
  runtime?: {
    zoom?: {
      pane_factor?: number | 'default';
      sidebar_factor?: number | 'default';
    };
  };
}

export interface RuntimePreferences {
  paneZoomFactor: number;
  sidebarZoomFactor: number;
}

const EXTERNAL_CONFIG_FILE_NAME = 'config.json';
const EXTERNAL_DEFAULT_CONFIG_FILE_NAME = 'config.default.json';
const EXTERNAL_CONFIG_DIR_NAME = 'lazy-llm';
const MIN_ZOOM_FACTOR = 0.25;
const MAX_ZOOM_FACTOR = 3.0;
const DEFAULT_SENTINEL = 'default';

export const DEFAULT_RUNTIME_PREFERENCES: RuntimePreferences = {
  paneZoomFactor: APP_CONFIG.runtime.zoom.paneDefaultFactor,
  sidebarZoomFactor: APP_CONFIG.runtime.zoom.sidebarDefaultFactor,
};

function getBaseConfigDirectory(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (typeof xdgConfigHome === 'string' && xdgConfigHome.trim().length > 0) {
    return xdgConfigHome;
  }
  return join(homedir(), '.config');
}

export function getExternalConfigDirectory(): string {
  return join(getBaseConfigDirectory(), EXTERNAL_CONFIG_DIR_NAME);
}

export function getExternalConfigPath(): string {
  return join(getExternalConfigDirectory(), EXTERNAL_CONFIG_FILE_NAME);
}

export function getExternalDefaultConfigPath(): string {
  return join(getExternalConfigDirectory(), EXTERNAL_DEFAULT_CONFIG_FILE_NAME);
}

function buildConcreteExternalDefaults(): ExternalConfigFile {
  const paneCount = APP_CONFIG.layout.pane.defaultCount;
  const providers = buildDefaultPaneProviders(paneCount);

  return {
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
  };
}

export function buildDefaultExternalConfig(): ExternalConfigFile {
  return {
    sidebar: {
      expanded_width: DEFAULT_SENTINEL,
    },
    defaults: {
      pane_count: DEFAULT_SENTINEL,
      providers: DEFAULT_SENTINEL,
    },
    runtime: {
      zoom: {
        pane_factor: DEFAULT_SENTINEL,
        sidebar_factor: DEFAULT_SENTINEL,
      },
    },
  };
}

export function ensureExternalConfigFile(): string {
  const configDir = getExternalConfigDirectory();
  const configPath = getExternalConfigPath();
  const defaultConfigPath = getExternalDefaultConfigPath();

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  writeFileSync(defaultConfigPath, `${JSON.stringify(buildConcreteExternalDefaults(), null, 2)}\n`, 'utf8');

  if (!existsSync(configPath)) {
    writeFileSync(configPath, `${JSON.stringify(buildDefaultExternalConfig(), null, 2)}\n`, 'utf8');
  }

  return configPath;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function resolveNumberOverride(value: unknown): number | undefined {
  if (value === DEFAULT_SENTINEL) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function resolveProvidersOverride(value: unknown): string[] | undefined {
  if (value === DEFAULT_SENTINEL) {
    return undefined;
  }
  if (!isStringArray(value)) {
    return undefined;
  }
  return value;
}

export function readExternalConfigFile(): ExternalConfigFile | null {
  const configPath = ensureExternalConfigFile();

  try {
    const raw = readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed as ExternalConfigFile;
  } catch (error) {
    console.error('[Config] Failed to parse external config file:', error);
    return null;
  }
}

export function mergeAppConfigWithExternal(
  baseConfig: AppConfig,
  externalConfig: ExternalConfigFile | null | undefined
): AppConfig {
  if (!externalConfig) {
    return baseConfig;
  }

  const expandedWidth = resolveNumberOverride(externalConfig.sidebar?.expanded_width);
  const paneCount = resolveNumberOverride(externalConfig.defaults?.pane_count);
  const providers = resolveProvidersOverride(externalConfig.defaults?.providers);

  return {
    ...baseConfig,
    sidebar: {
      ...baseConfig.sidebar,
      expanded_width: expandedWidth ?? baseConfig.sidebar.expanded_width,
    },
    defaults: {
      ...baseConfig.defaults,
      pane_count: paneCount ?? baseConfig.defaults.pane_count,
      providers: providers ?? baseConfig.defaults.providers,
    },
  };
}

function normalizeZoomFactor(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(MIN_ZOOM_FACTOR, Math.min(MAX_ZOOM_FACTOR, value));
}

export function normalizeRuntimePreferences(
  runtimePreferences: Partial<RuntimePreferences> | null | undefined,
  fallback: RuntimePreferences = DEFAULT_RUNTIME_PREFERENCES
): RuntimePreferences {
  return {
    paneZoomFactor: normalizeZoomFactor(runtimePreferences?.paneZoomFactor, fallback.paneZoomFactor),
    sidebarZoomFactor: normalizeZoomFactor(
      runtimePreferences?.sidebarZoomFactor,
      fallback.sidebarZoomFactor
    ),
  };
}

export function mergeRuntimePreferencesWithExternal(
  baseRuntimePreferences: RuntimePreferences,
  externalConfig: ExternalConfigFile | null | undefined
): RuntimePreferences {
  const paneFactor = resolveNumberOverride(externalConfig?.runtime?.zoom?.pane_factor);
  const sidebarFactor = resolveNumberOverride(externalConfig?.runtime?.zoom?.sidebar_factor);

  return {
    paneZoomFactor: normalizeZoomFactor(
      paneFactor,
      baseRuntimePreferences.paneZoomFactor
    ),
    sidebarZoomFactor: normalizeZoomFactor(
      sidebarFactor,
      baseRuntimePreferences.sidebarZoomFactor
    ),
  };
}
