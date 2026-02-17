import { APP_CONFIG } from '@/config';
import { normalizePaneProviderSequence } from '@/features/providers/paneProviders';
import type { PaneCount } from './context';

export interface SidebarTabState {
  id: string;
  paneCount: PaneCount;
  paneProviders: string[];
}

export interface SidebarTabsState {
  tabs: SidebarTabState[];
  activeTabId: string;
}

export type TabMoveDirection = 'prev' | 'next';

export const MAX_SIDEBAR_TABS = 8;
const TAB_ID_PREFIX = 'tab';

const paneMin = APP_CONFIG.layout.pane.minCount;
const paneMax = APP_CONFIG.layout.pane.maxCount;

export function clampPaneCount(count: number): PaneCount {
  const normalized = Math.min(paneMax, Math.max(paneMin, Math.floor(count)));
  return normalized as PaneCount;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function fallbackTabId(index: number): string {
  return `${TAB_ID_PREFIX}-${index + 1}`;
}

function ensureUniqueTabId(preferredId: string, usedIds: Set<string>): string {
  if (!usedIds.has(preferredId)) {
    usedIds.add(preferredId);
    return preferredId;
  }

  let suffix = 2;
  let candidate = `${preferredId}-${suffix}`;
  while (usedIds.has(candidate)) {
    suffix += 1;
    candidate = `${preferredId}-${suffix}`;
  }

  usedIds.add(candidate);
  return candidate;
}

export function createSidebarTabState(input: {
  id: string;
  paneCount: number;
  paneProviders: readonly string[];
}): SidebarTabState {
  const paneCount = clampPaneCount(input.paneCount);
  return {
    id: input.id,
    paneCount,
    paneProviders: normalizePaneProviderSequence(input.paneProviders, paneCount),
  };
}

export function normalizeSidebarTabsState(params: {
  tabs: ReadonlyArray<{
    id?: unknown;
    paneCount?: unknown;
    paneProviders?: unknown;
  }> | undefined;
  activeTabId: unknown;
  fallbackTab: SidebarTabState;
}): SidebarTabsState {
  const usedIds = new Set<string>();
  const rawTabs = Array.isArray(params.tabs)
    ? params.tabs.slice(0, MAX_SIDEBAR_TABS)
    : [];

  const normalizedTabs = rawTabs.map((rawTab, index) => {
    const preferredId = toNonEmptyString(rawTab.id) ?? fallbackTabId(index);
    const paneCount = clampPaneCount(
      typeof rawTab.paneCount === 'number' ? rawTab.paneCount : params.fallbackTab.paneCount,
    );
    const paneProvidersSource = Array.isArray(rawTab.paneProviders)
      ? rawTab.paneProviders
      : params.fallbackTab.paneProviders;

    return {
      id: ensureUniqueTabId(preferredId, usedIds),
      paneCount,
      paneProviders: normalizePaneProviderSequence(paneProvidersSource, paneCount),
    };
  });

  if (normalizedTabs.length === 0) {
    const fallbackId = ensureUniqueTabId(params.fallbackTab.id, usedIds);
    normalizedTabs.push({
      id: fallbackId,
      paneCount: params.fallbackTab.paneCount,
      paneProviders: normalizePaneProviderSequence(
        params.fallbackTab.paneProviders,
        params.fallbackTab.paneCount,
      ),
    });
  }

  const preferredActiveTabId = toNonEmptyString(params.activeTabId);
  const activeTabId = preferredActiveTabId
    && normalizedTabs.some((tab) => tab.id === preferredActiveTabId)
    ? preferredActiveTabId
    : normalizedTabs[0].id;

  return {
    tabs: normalizedTabs,
    activeTabId,
  };
}

export function findSidebarTab(
  tabs: readonly SidebarTabState[],
  activeTabId: string,
): SidebarTabState {
  const matched = tabs.find((tab) => tab.id === activeTabId);
  if (matched) {
    return matched;
  }
  const fallback = tabs[0];
  if (fallback) {
    return fallback;
  }
  throw new Error('Sidebar tabs are empty');
}

export function updateSidebarTabSnapshot(
  tabs: readonly SidebarTabState[],
  tabId: string,
  snapshot: {
    paneCount: PaneCount;
    paneProviders: readonly string[];
  },
): SidebarTabState[] {
  const nextPaneProviders = normalizePaneProviderSequence(snapshot.paneProviders, snapshot.paneCount);

  return tabs.map((tab) => {
    if (tab.id !== tabId) {
      return tab;
    }
    return {
      ...tab,
      paneCount: snapshot.paneCount,
      paneProviders: nextPaneProviders,
    };
  });
}

function findNextTabNumber(tabs: readonly SidebarTabState[]): number {
  let maxTabNumber = 0;
  for (const tab of tabs) {
    const matched = /^tab-(\d+)$/.exec(tab.id);
    if (!matched) {
      continue;
    }
    const numberValue = Number.parseInt(matched[1], 10);
    if (Number.isInteger(numberValue) && numberValue > maxTabNumber) {
      maxTabNumber = numberValue;
    }
  }
  return maxTabNumber + 1;
}

export function createNextSidebarTab(
  tabs: readonly SidebarTabState[],
  sourceTab: SidebarTabState,
): SidebarTabState {
  return {
    id: `tab-${findNextTabNumber(tabs)}`,
    paneCount: sourceTab.paneCount,
    paneProviders: normalizePaneProviderSequence(sourceTab.paneProviders, sourceTab.paneCount),
  };
}

export function removeSidebarTab(
  tabs: readonly SidebarTabState[],
  activeTabId: string,
  tabId: string,
): SidebarTabsState {
  const removeIndex = tabs.findIndex((tab) => tab.id === tabId);
  if (removeIndex < 0 || tabs.length <= 1) {
    return {
      tabs: [...tabs],
      activeTabId,
    };
  }

  const nextTabs = tabs.filter((tab) => tab.id !== tabId);
  const fallbackActiveTab = nextTabs[Math.max(0, removeIndex - 1)] ?? nextTabs[0];
  const nextActiveTabId = activeTabId === tabId
    ? fallbackActiveTab.id
    : activeTabId;

  return {
    tabs: nextTabs,
    activeTabId: nextActiveTabId,
  };
}

export function getAdjacentTabId(
  tabs: readonly SidebarTabState[],
  activeTabId: string,
  direction: TabMoveDirection,
): string | null {
  if (tabs.length === 0) {
    return null;
  }

  const activeTabIndex = tabs.findIndex((tab) => tab.id === activeTabId);
  const baseIndex = activeTabIndex >= 0 ? activeTabIndex : 0;
  const delta = direction === 'prev' ? -1 : 1;
  const nextIndex = (baseIndex + delta + tabs.length) % tabs.length;

  return tabs[nextIndex]?.id ?? null;
}
