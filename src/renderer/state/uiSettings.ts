import { z } from 'zod';
import { APP_CONFIG } from '@/config';
import type { AppConfig } from '@/runtime/sidebar';
import {
  MAX_SIDEBAR_TABS,
  clampPaneCount,
  createSidebarTabState,
  normalizeSidebarTabsState,
  type SidebarTabState,
} from '../sidebar/tabsState';

const STORAGE_KEY = 'lazyllm.settings.v1';
const LEGACY_SETTINGS_VERSION = 1 as const;
const SETTINGS_VERSION = 2 as const;

const paneMin = APP_CONFIG.layout.pane.minCount;
const paneMax = APP_CONFIG.layout.pane.maxCount;
const sidebarMin = APP_CONFIG.layout.sidebar.minExpandedWidth;
const sidebarMax = APP_CONFIG.layout.sidebar.maxExpandedWidth;

const legacyUiSettingsSchema = z.object({
  version: z.literal(LEGACY_SETTINGS_VERSION).default(LEGACY_SETTINGS_VERSION),
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

const tabSettingsSchema = z.object({
  id: z.string().min(1).optional(),
  paneCount: z.number().int().min(paneMin).max(paneMax).optional(),
  paneKeys: z.array(z.string()).max(paneMax).optional(),
});

const uiSettingsSchema = z.object({
  version: z.literal(SETTINGS_VERSION).default(SETTINGS_VERSION),
  layout: z
    .object({
      sidebarWidth: z.number().int().min(sidebarMin).max(sidebarMax).optional(),
    })
    .default({}),
  tabs: z
    .object({
      activeTabId: z.string().min(1).optional(),
      items: z.array(tabSettingsSchema).max(MAX_SIDEBAR_TABS).optional(),
    })
    .default({}),
});

const persistedUiSettingsSchema = z.union([uiSettingsSchema, legacyUiSettingsSchema]);

type LegacyUiSettings = z.infer<typeof legacyUiSettingsSchema>;
type PersistedUiSettings = z.infer<typeof persistedUiSettingsSchema>;
export type UiSettings = z.infer<typeof uiSettingsSchema>;

export interface ResolvedUiState {
  sidebarWidth: number;
  tabs: SidebarTabState[];
  activeTabId: string;
}

function normalizeSidebarWidth(width: number): number {
  return Math.max(sidebarMin, Math.min(sidebarMax, Math.floor(width)));
}

export function loadUiSettings(): PersistedUiSettings {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return persistedUiSettingsSchema.parse({});
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return persistedUiSettingsSchema.parse({});
    }

    const parsed = JSON.parse(raw) as unknown;
    return persistedUiSettingsSchema.parse(parsed);
  } catch (error) {
    console.error('[uiSettings] Failed to load local settings:', error);
    return persistedUiSettingsSchema.parse({});
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

function createFallbackTabFromLegacySettings(
  localSettings: LegacyUiSettings,
  config: AppConfig,
): SidebarTabState {
  const paneCount = clampPaneCount(localSettings.layout.paneCount ?? config.provider.pane_count);
  return createSidebarTabState({
    id: 'tab-1',
    paneCount,
    paneProviders: localSettings.providers.paneKeys ?? config.provider.panes,
  });
}

function createFallbackTabFromConfig(config: AppConfig): SidebarTabState {
  return createSidebarTabState({
    id: 'tab-1',
    paneCount: config.provider.pane_count,
    paneProviders: config.provider.panes,
  });
}

export function resolveStartupState(config: AppConfig): ResolvedUiState {
  const localSettings = loadUiSettings();
  const sidebarWidth = normalizeSidebarWidth(
    localSettings.layout.sidebarWidth ?? config.sidebar.expanded_width,
  );

  if (localSettings.version === LEGACY_SETTINGS_VERSION) {
    const fallbackTab = createFallbackTabFromLegacySettings(localSettings, config);
    return {
      sidebarWidth,
      tabs: [fallbackTab],
      activeTabId: fallbackTab.id,
    };
  }

  const fallbackTab = createFallbackTabFromConfig(config);
  const normalizedTabsState = normalizeSidebarTabsState({
    tabs: localSettings.tabs.items?.map((tab) => {
      return {
        id: tab.id,
        paneCount: tab.paneCount,
        paneProviders: tab.paneKeys,
      };
    }),
    activeTabId: localSettings.tabs.activeTabId,
    fallbackTab,
  });

  return {
    sidebarWidth,
    tabs: normalizedTabsState.tabs,
    activeTabId: normalizedTabsState.activeTabId,
  };
}
