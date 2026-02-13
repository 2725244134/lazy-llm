import { z } from 'zod';
import { APP_CONFIG } from '@/config';
import type { AppConfig } from '@/runtime/sidebar';
import type { PaneCount } from '../sidebar/context';

const STORAGE_KEY = 'lazyllm.settings.v1';
const SETTINGS_VERSION = 1 as const;

const paneMin = APP_CONFIG.layout.pane.minCount;
const paneMax = APP_CONFIG.layout.pane.maxCount;
const sidebarMin = APP_CONFIG.layout.sidebar.minExpandedWidth;
const sidebarMax = APP_CONFIG.layout.sidebar.maxExpandedWidth;

const providerKeys = APP_CONFIG.providers.catalog.map((provider) => provider.key);
const providerKeySet: Set<string> = new Set(providerKeys);
const fallbackProvider = APP_CONFIG.providers.defaultPaneKeys[0] ?? providerKeys[0] ?? 'chatgpt';

const uiSettingsSchema = z.object({
  version: z.literal(SETTINGS_VERSION).default(SETTINGS_VERSION),
  layout: z
    .object({
      paneCount: z.number().int().min(paneMin).max(paneMax).optional(),
      sidebarWidth: z.number().int().min(sidebarMin).max(sidebarMax).optional(),
    })
    .default({}),
  providers: z
    .object({
      paneKeys: z.array(z.string()).max(paneMax).optional(),
    })
    .default({}),
});

export type UiSettings = z.infer<typeof uiSettingsSchema>;

export interface ResolvedUiState {
  paneCount: PaneCount;
  sidebarWidth: number;
  paneProviders: string[];
}

function normalizePaneCount(count: number): PaneCount {
  const clamped = Math.max(paneMin, Math.min(paneMax, Math.floor(count)));
  return clamped as PaneCount;
}

function normalizeSidebarWidth(width: number): number {
  return Math.max(sidebarMin, Math.min(sidebarMax, Math.floor(width)));
}

function normalizePaneProviders(providers: readonly string[], paneCount: PaneCount): string[] {
  const firstProvider = providers[0] && providerKeySet.has(providers[0])
    ? providers[0]
    : fallbackProvider;

  return Array.from({ length: paneCount }, (_, paneIndex) => {
    const candidate = providers[paneIndex];
    if (typeof candidate === 'string' && providerKeySet.has(candidate)) {
      return candidate;
    }
    return firstProvider;
  });
}

export function loadUiSettings(): UiSettings {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return uiSettingsSchema.parse({});
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return uiSettingsSchema.parse({});
    }

    const parsed = JSON.parse(raw) as unknown;
    return uiSettingsSchema.parse(parsed);
  } catch (error) {
    console.error('[uiSettings] Failed to load local settings:', error);
    return uiSettingsSchema.parse({});
  }
}

export function saveUiSettings(settings: UiSettings): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }

  try {
    const normalized = uiSettingsSchema.parse(settings);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch (error) {
    console.error('[uiSettings] Failed to save local settings:', error);
  }
}

export function resolveStartupState(config: AppConfig): ResolvedUiState {
  const localSettings = loadUiSettings();
  const paneCount = normalizePaneCount(localSettings.layout.paneCount ?? config.provider.pane_count);
  const sidebarWidth = normalizeSidebarWidth(
    localSettings.layout.sidebarWidth ?? config.sidebar.expanded_width,
  );

  const paneProvidersSource = localSettings.providers.paneKeys ?? config.provider.panes;
  const paneProviders = normalizePaneProviders(paneProvidersSource, paneCount);

  return {
    paneCount,
    sidebarWidth,
    paneProviders,
  };
}
