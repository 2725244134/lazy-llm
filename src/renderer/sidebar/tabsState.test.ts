import { describe, expect, it } from 'vitest';
import {
  clampPaneCount,
  createNextSidebarTab,
  createSidebarTabState,
  findSidebarTab,
  getAdjacentTabId,
  normalizeSidebarTabsState,
  removeSidebarTab,
  updateSidebarTabSnapshot,
  type SidebarTabState,
} from './tabsState';

function createDefaultTab(overrides?: Partial<SidebarTabState>): SidebarTabState {
  return {
    id: 'tab-1',
    paneCount: 2,
    paneProviders: ['chatgpt', 'claude'],
    ...overrides,
  };
}

describe('tabsState', () => {
  it('clamps pane count into supported range', () => {
    expect(clampPaneCount(0)).toBe(1);
    expect(clampPaneCount(10)).toBe(4);
    expect(clampPaneCount(2.8)).toBe(2);
  });

  it('normalizes tabs and keeps active tab when present', () => {
    const fallbackTab = createDefaultTab();

    const { tabs, activeTabId } = normalizeSidebarTabsState({
      fallbackTab,
      activeTabId: 'work',
      tabs: [
        { id: 'work', paneCount: 3, paneProviders: ['chatgpt'] },
        { id: 'work', paneCount: 1, paneProviders: ['gemini'] },
      ],
    });

    expect(tabs).toHaveLength(2);
    expect(tabs[0].id).toBe('work');
    expect(tabs[1].id).toBe('work-2');
    expect(tabs[0].paneCount).toBe(3);
    expect(tabs[0].paneProviders).toHaveLength(3);
    expect(activeTabId).toBe('work');
  });

  it('creates fallback tab when settings do not include tabs', () => {
    const fallbackTab = createDefaultTab();

    const { tabs, activeTabId } = normalizeSidebarTabsState({
      fallbackTab,
      activeTabId: 'missing',
      tabs: undefined,
    });

    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toEqual(fallbackTab);
    expect(activeTabId).toBe(fallbackTab.id);
  });

  it('updates active tab snapshot without mutating other tabs', () => {
    const tabs = [
      createDefaultTab(),
      createDefaultTab({ id: 'tab-2', paneCount: 1, paneProviders: ['gemini'] }),
    ];

    const nextTabs = updateSidebarTabSnapshot(tabs, 'tab-2', {
      paneCount: 3,
      paneProviders: ['claude'],
    });

    expect(nextTabs[0]).toEqual(tabs[0]);
    expect(nextTabs[1].paneCount).toBe(3);
    expect(nextTabs[1].paneProviders).toHaveLength(3);
  });

  it('creates next tab from active tab snapshot', () => {
    const existingTabs = [
      createSidebarTabState({
        id: 'tab-1',
        paneCount: 2,
        paneProviders: ['chatgpt', 'claude'],
      }),
      createSidebarTabState({
        id: 'work',
        paneCount: 1,
        paneProviders: ['gemini'],
      }),
    ];

    const nextTab = createNextSidebarTab(existingTabs, findSidebarTab(existingTabs, 'work'));

    expect(nextTab.id).toBe('tab-2');
    expect(nextTab.paneCount).toBe(1);
    expect(nextTab.paneProviders).toEqual(['gemini']);
  });

  it('removes active tab and selects previous neighbor', () => {
    const tabs = [
      createDefaultTab({ id: 'tab-1' }),
      createDefaultTab({ id: 'tab-2', paneCount: 1, paneProviders: ['gemini'] }),
      createDefaultTab({ id: 'tab-3', paneCount: 3, paneProviders: ['chatgpt', 'claude', 'gemini'] }),
    ];

    const result = removeSidebarTab(tabs, 'tab-2', 'tab-2');

    expect(result.tabs.map((tab) => tab.id)).toEqual(['tab-1', 'tab-3']);
    expect(result.activeTabId).toBe('tab-1');
  });

  it('resolves adjacent tabs with circular navigation', () => {
    const tabs = [
      createDefaultTab({ id: 'tab-1' }),
      createDefaultTab({ id: 'tab-2' }),
      createDefaultTab({ id: 'tab-3' }),
    ];

    expect(getAdjacentTabId(tabs, 'tab-1', 'next')).toBe('tab-2');
    expect(getAdjacentTabId(tabs, 'tab-3', 'next')).toBe('tab-1');
    expect(getAdjacentTabId(tabs, 'tab-1', 'prev')).toBe('tab-3');
    expect(getAdjacentTabId(tabs, 'tab-2', 'prev')).toBe('tab-1');
  });
});
