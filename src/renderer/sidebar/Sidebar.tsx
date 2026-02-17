import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { APP_CONFIG } from '@/config';
import { resolveSidebarUiDensity } from '@/config/layout';
import { getSidebarRuntime } from '@/runtime/sidebar';
import { ACTIVE_THEME_PRESET, getSidebarThemeVars } from '@/theme/palette';
import { normalizePaneProviderSequence } from '@/features/providers/paneProviders';
import { PaneSelector } from './PaneSelector';
import { ProviderList } from './ProviderList';
import { QuickPromptQueue } from './QuickPromptQueue';
import { TabsBar } from './TabsBar';
import { type PaneCount, SidebarContextProvider } from './context';
import { resolveStartupState, saveUiSettings } from '../state/uiSettings';
import { useSidebarLayoutSync } from './useSidebarLayoutSync';
import {
  MAX_SIDEBAR_TABS,
  clampPaneCount,
  createNextSidebarTab,
  createSidebarTabState,
  findSidebarTab,
  getAdjacentTabId,
  removeSidebarTab,
  updateSidebarTabSnapshot,
  type SidebarTabState,
} from './tabsState';

const SIDEBAR_TOGGLE_SHORTCUT_EVENT = APP_CONFIG.interaction.shortcuts.sidebarToggleEvent;
const PROVIDER_LOADING_EVENT = APP_CONFIG.interaction.shortcuts.providerLoadingEvent;

const DEFAULT_INITIAL_TAB = createSidebarTabState({
  id: 'tab-1',
  paneCount: APP_CONFIG.layout.pane.defaultCount,
  paneProviders: APP_CONFIG.providers.defaultActiveKeys,
});

function isEditableElement(node: EventTarget | null): boolean {
  if (!(node instanceof HTMLElement)) {
    return false;
  }

  if (node.isContentEditable) {
    return true;
  }

  const tagName = node.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

export function Sidebar() {
  const runtime = useMemo(() => getSidebarRuntime(), []);

  const [collapsed, setCollapsed] = useState(false);
  const [tabs, setTabs] = useState<SidebarTabState[]>([DEFAULT_INITIAL_TAB]);
  const [activeTabId, setActiveTabId] = useState<string>(DEFAULT_INITIAL_TAB.id);
  const [paneCount, setPaneCountState] = useState<PaneCount>(DEFAULT_INITIAL_TAB.paneCount);
  const [activeProviders, setActiveProviders] = useState<string[]>(DEFAULT_INITIAL_TAB.paneProviders);
  const [providerLoadingByPane, setProviderLoadingByPane] = useState<Record<number, boolean>>({});
  const [expandedWidth, setExpandedWidth] = useState<number>(
    APP_CONFIG.layout.sidebar.defaultExpandedWidth,
  );

  const collapsedRef = useRef(collapsed);
  const tabsRef = useRef(tabs);
  const activeTabIdRef = useRef(activeTabId);
  const paneCountRef = useRef(paneCount);
  const activeProvidersRef = useRef(activeProviders);
  const expandedWidthRef = useRef(expandedWidth);

  useEffect(() => {
    collapsedRef.current = collapsed;
  }, [collapsed]);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    paneCountRef.current = paneCount;
  }, [paneCount]);

  useEffect(() => {
    activeProvidersRef.current = activeProviders;
  }, [activeProviders]);

  useEffect(() => {
    expandedWidthRef.current = expandedWidth;
  }, [expandedWidth]);

  const collapsedWidth = APP_CONFIG.layout.sidebar.defaultCollapsedWidth;
  const sidebarTransitionDurationMs = APP_CONFIG.layout.sidebar.transitionDurationMs;
  const isElectronRuntime = typeof window !== 'undefined' && typeof window.lazyllm !== 'undefined';

  const configuredSidebarWidth = collapsed ? collapsedWidth : expandedWidth;

  const sidebarUiDensity = collapsed ? 'regular' : resolveSidebarUiDensity(configuredSidebarWidth);
  const isCompactSidebar = sidebarUiDensity !== 'regular';
  const isTightSidebar = sidebarUiDensity === 'tight';

  const persistUiSettings = useCallback((overrides?: {
    tabs?: SidebarTabState[];
    activeTabId?: string;
    sidebarWidth?: number;
  }) => {
    const nextTabs = overrides?.tabs ?? tabsRef.current;
    const nextActiveTabId = overrides?.activeTabId ?? activeTabIdRef.current;

    saveUiSettings({
      version: 2,
      layout: {
        sidebarWidth: overrides?.sidebarWidth ?? expandedWidthRef.current,
      },
      tabs: {
        activeTabId: nextActiveTabId,
        items: nextTabs.map((tab) => {
          return {
            id: tab.id,
            paneCount: tab.paneCount,
            paneKeys: tab.paneProviders,
          };
        }),
      },
    });
  }, []);

  const {
    enqueueLayoutSync,
    invalidateLayoutSignature,
    scheduleResizeLayoutSync,
    cancelPendingFrames,
  } = useSidebarLayoutSync({
    runtime,
    paneCountRef,
    collapsedRef,
    expandedWidthRef,
    collapsedWidth,
  });

  const trimProviderLoadingState = useCallback((count: PaneCount) => {
    setProviderLoadingByPane((current) => {
      const next: Record<number, boolean> = {};
      for (const [paneIndexRaw, loading] of Object.entries(current)) {
        const paneIndex = Number(paneIndexRaw);
        if (!Number.isInteger(paneIndex) || paneIndex < 0 || paneIndex >= count || !loading) {
          continue;
        }
        next[paneIndex] = true;
      }
      return next;
    });
  }, []);

  const setProviderLoadingState = useCallback((paneIndex: number, loading: boolean) => {
    setProviderLoadingByPane((current) => {
      const next = { ...current };
      if (loading) {
        next[paneIndex] = true;
      } else {
        delete next[paneIndex];
      }
      return next;
    });
  }, []);

  const setActiveTabState = useCallback((tab: SidebarTabState) => {
    activeTabIdRef.current = tab.id;
    setActiveTabId(tab.id);
    paneCountRef.current = tab.paneCount;
    setPaneCountState(tab.paneCount);
    const normalizedProviders = normalizePaneProviderSequence(tab.paneProviders, tab.paneCount);
    activeProvidersRef.current = normalizedProviders;
    setActiveProviders(normalizedProviders);
  }, []);

  const updateTabsState = useCallback((nextTabs: SidebarTabState[]) => {
    tabsRef.current = nextTabs;
    setTabs(nextTabs);
  }, []);

  const applyTabToRuntime = useCallback(
    async (tab: SidebarTabState) => {
      await runtime.activateTab(tab.id, tab.paneCount, tab.paneProviders);
    },
    [runtime],
  );

  const toggleCollapse = useCallback(async () => {
    const nextCollapsed = !collapsedRef.current;
    collapsedRef.current = nextCollapsed;
    setCollapsed(nextCollapsed);

    await enqueueLayoutSync();
  }, [enqueueLayoutSync]);

  const createTab = useCallback(async () => {
    const currentTabs = tabsRef.current;
    if (currentTabs.length >= MAX_SIDEBAR_TABS) {
      return;
    }

    const previousTab = findSidebarTab(currentTabs, activeTabIdRef.current);
    const nextTab = createNextSidebarTab(currentTabs, previousTab);
    const nextTabs = [...currentTabs, nextTab];

    updateTabsState(nextTabs);
    setActiveTabState(nextTab);
    trimProviderLoadingState(nextTab.paneCount);
    try {
      await applyTabToRuntime(nextTab);
      persistUiSettings({
        tabs: nextTabs,
        activeTabId: nextTab.id,
      });
    } catch (error) {
      console.error('[Sidebar] createTab error:', error);
      updateTabsState(currentTabs);
      setActiveTabState(previousTab);
      trimProviderLoadingState(previousTab.paneCount);

      try {
        await applyTabToRuntime(previousTab);
      } catch (restoreError) {
        console.error('[Sidebar] createTab rollback error:', restoreError);
      }
    }

    await enqueueLayoutSync();
  }, [
    applyTabToRuntime,
    enqueueLayoutSync,
    persistUiSettings,
    setActiveTabState,
    trimProviderLoadingState,
    updateTabsState,
  ]);

  const switchTab = useCallback(
    async (tabId: string) => {
      const currentTabs = tabsRef.current;
      const currentActiveTabId = activeTabIdRef.current;
      if (tabId === currentActiveTabId) {
        return;
      }

      const targetTab = currentTabs.find((tab) => tab.id === tabId);
      if (!targetTab) {
        return;
      }

      const previousTab = findSidebarTab(currentTabs, currentActiveTabId);
      setActiveTabState(targetTab);
      trimProviderLoadingState(targetTab.paneCount);

      try {
        await applyTabToRuntime(targetTab);
        persistUiSettings({
          tabs: currentTabs,
          activeTabId: targetTab.id,
        });
      } catch (error) {
        console.error('[Sidebar] switchTab error:', error);
        setActiveTabState(previousTab);
        trimProviderLoadingState(previousTab.paneCount);

        try {
          await applyTabToRuntime(previousTab);
        } catch (restoreError) {
          console.error('[Sidebar] switchTab rollback error:', restoreError);
        }
      }

      await enqueueLayoutSync();
    },
    [
      applyTabToRuntime,
      enqueueLayoutSync,
      persistUiSettings,
      setActiveTabState,
      trimProviderLoadingState,
    ],
  );

  const closeTab = useCallback(
    async (tabId: string) => {
      const currentTabs = tabsRef.current;
      const currentActiveTabId = activeTabIdRef.current;
      const removal = removeSidebarTab(currentTabs, currentActiveTabId, tabId);
      if (removal.tabs.length === currentTabs.length) {
        return;
      }

      const previousTab = findSidebarTab(currentTabs, currentActiveTabId);
      updateTabsState(removal.tabs);

      if (removal.activeTabId === currentActiveTabId) {
        persistUiSettings({
          tabs: removal.tabs,
          activeTabId: removal.activeTabId,
        });
        try {
          await runtime.closeTab(tabId);
        } catch (error) {
          console.error('[Sidebar] closeTab cleanup error:', error);
        }
        return;
      }

      const nextActiveTab = findSidebarTab(removal.tabs, removal.activeTabId);
      setActiveTabState(nextActiveTab);
      trimProviderLoadingState(nextActiveTab.paneCount);

      try {
        await applyTabToRuntime(nextActiveTab);
        try {
          await runtime.closeTab(tabId);
        } catch (cleanupError) {
          console.error('[Sidebar] closeTab cleanup error:', cleanupError);
        }
        persistUiSettings({
          tabs: removal.tabs,
          activeTabId: removal.activeTabId,
        });
      } catch (error) {
        console.error('[Sidebar] closeTab error:', error);
        updateTabsState(currentTabs);
        setActiveTabState(previousTab);
        trimProviderLoadingState(previousTab.paneCount);

        try {
          await applyTabToRuntime(previousTab);
        } catch (restoreError) {
          console.error('[Sidebar] closeTab rollback error:', restoreError);
        }
      }

      await enqueueLayoutSync();
    },
    [
      applyTabToRuntime,
      enqueueLayoutSync,
      persistUiSettings,
      runtime,
      setActiveTabState,
      trimProviderLoadingState,
      updateTabsState,
    ],
  );

  const setPaneCount = useCallback(
    async (count: number) => {
      const oldCount = paneCountRef.current;
      const oldProviders = normalizePaneProviderSequence(activeProvidersRef.current, oldCount);
      const oldTabs = tabsRef.current;
      const activeTab = activeTabIdRef.current;

      const newCount = clampPaneCount(count);
      if (newCount === oldCount) {
        return;
      }

      const nextProviders = normalizePaneProviderSequence(activeProvidersRef.current, newCount);

      paneCountRef.current = newCount;
      setPaneCountState(newCount);
      activeProvidersRef.current = nextProviders;
      setActiveProviders(nextProviders);

      const nextTabs = updateSidebarTabSnapshot(oldTabs, activeTab, {
        paneCount: newCount,
        paneProviders: nextProviders,
      });
      updateTabsState(nextTabs);

      try {
        await runtime.setPaneCount(newCount);
        trimProviderLoadingState(newCount);
        persistUiSettings({
          tabs: nextTabs,
        });
      } catch (error) {
        invalidateLayoutSignature();
        paneCountRef.current = oldCount;
        setPaneCountState(oldCount);
        activeProvidersRef.current = oldProviders;
        setActiveProviders(oldProviders);
        updateTabsState(oldTabs);
        trimProviderLoadingState(oldCount);
        console.error('[Sidebar] setPaneCount error:', error);
      }

      await enqueueLayoutSync();
    },
    [
      enqueueLayoutSync,
      invalidateLayoutSignature,
      persistUiSettings,
      runtime,
      trimProviderLoadingState,
      updateTabsState,
    ],
  );

  const newAll = useCallback(async () => {
    try {
      await runtime.resetAllPanes();
    } catch (error) {
      console.error('[Sidebar] newAll error:', error);
    }
  }, [runtime]);

  const setProvider = useCallback(
    async (paneIndex: number, providerKey: string) => {
      if (activeProvidersRef.current[paneIndex] === providerKey) {
        return;
      }

      const oldProviders = normalizePaneProviderSequence(
        activeProvidersRef.current,
        paneCountRef.current,
      );
      const oldTabs = tabsRef.current;
      const activeTab = activeTabIdRef.current;

      const nextProviders = normalizePaneProviderSequence(
        activeProvidersRef.current,
        paneCountRef.current,
      );
      nextProviders[paneIndex] = providerKey;
      activeProvidersRef.current = nextProviders;
      setActiveProviders(nextProviders);

      const nextTabs = updateSidebarTabSnapshot(oldTabs, activeTab, {
        paneCount: paneCountRef.current,
        paneProviders: nextProviders,
      });
      updateTabsState(nextTabs);

      try {
        await runtime.updateProvider(paneIndex, providerKey);
        persistUiSettings({
          tabs: nextTabs,
        });
      } catch (error) {
        activeProvidersRef.current = oldProviders;
        setActiveProviders(oldProviders);
        updateTabsState(oldTabs);
        setProviderLoadingState(paneIndex, false);
        console.error('[Sidebar] setProvider error:', error);
      }
    },
    [persistUiSettings, runtime, setProviderLoadingState, updateTabsState],
  );

  const sendPrompt = useCallback(
    async (text: string) => {
      try {
        await runtime.sendPrompt(text);
      } catch (error) {
        console.error('[Sidebar] sendPrompt error:', error);
        throw error;
      }
    },
    [runtime],
  );

  const syncPromptDraft = useCallback(
    async (text: string) => {
      try {
        await runtime.syncPromptDraft(text);
      } catch (error) {
        console.error('[Sidebar] syncPromptDraft error:', error);
      }
    },
    [runtime],
  );

  const removeQueuedPromptItem = useCallback(
    async (queueItemId: string) => {
      try {
        return await runtime.removeQueuedPromptItem(queueItemId);
      } catch (error) {
        console.error('[Sidebar] removeQueuedPromptItem error:', error);
        throw error;
      }
    },
    [runtime],
  );

  const removeQueuedPromptRound = useCallback(
    async (roundId: number) => {
      try {
        return await runtime.removeQueuedPromptRound(roundId);
      } catch (error) {
        console.error('[Sidebar] removeQueuedPromptRound error:', error);
        throw error;
      }
    },
    [runtime],
  );

  const clearQueuedPrompts = useCallback(
    async () => {
      try {
        return await runtime.clearQueuedPrompts();
      } catch (error) {
        console.error('[Sidebar] clearQueuedPrompts error:', error);
        throw error;
      }
    },
    [runtime],
  );

  useEffect(() => {
    const handleWindowResize = () => {
      scheduleResizeLayoutSync();
    };

    const handleSidebarToggleShortcut = () => {
      void toggleCollapse();
    };

    const handleProviderLoadingEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ paneIndex: number; loading: boolean }>).detail;
      if (
        !detail
        || typeof detail.paneIndex !== 'number'
        || !Number.isInteger(detail.paneIndex)
        || detail.paneIndex < 0
        || typeof detail.loading !== 'boolean'
      ) {
        return;
      }

      setProviderLoadingState(detail.paneIndex, detail.loading);
    };

    const handleTabShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.shiftKey) {
        return;
      }
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      if (isEditableElement(event.target)) {
        return;
      }

      const keyLower = event.key.toLowerCase();
      if (keyLower === 'w') {
        event.preventDefault();
        void closeTab(activeTabIdRef.current);
        return;
      }

      if (keyLower === 't') {
        event.preventDefault();
        void createTab();
        return;
      }

      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return;
      }

      const direction = event.key === 'ArrowLeft' ? 'prev' : 'next';
      const nextTabId = getAdjacentTabId(tabsRef.current, activeTabIdRef.current, direction);
      if (!nextTabId || nextTabId === activeTabIdRef.current) {
        return;
      }

      event.preventDefault();
      void switchTab(nextTabId);
    };

    let active = true;

    const initialize = async () => {
      try {
        const config = await runtime.getConfig();
        const startupState = resolveStartupState(config);
        const startupActiveTab = findSidebarTab(startupState.tabs, startupState.activeTabId);

        if (!active) {
          return;
        }

        setExpandedWidth(startupState.sidebarWidth);
        expandedWidthRef.current = startupState.sidebarWidth;

        updateTabsState(startupState.tabs);
        setActiveTabState(startupActiveTab);
        trimProviderLoadingState(startupActiveTab.paneCount);
        await applyTabToRuntime(startupActiveTab);

        persistUiSettings({
          tabs: startupState.tabs,
          activeTabId: startupActiveTab.id,
          sidebarWidth: startupState.sidebarWidth,
        });
      } catch (error) {
        console.error('[Sidebar] initialize error:', error);
      }

      if (!active) {
        return;
      }

      await enqueueLayoutSync();
    };

    window.addEventListener('resize', handleWindowResize);
    window.addEventListener(SIDEBAR_TOGGLE_SHORTCUT_EVENT, handleSidebarToggleShortcut);
    window.addEventListener(PROVIDER_LOADING_EVENT, handleProviderLoadingEvent as EventListener);
    window.addEventListener('keydown', handleTabShortcut);

    void initialize();

    return () => {
      active = false;
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener(SIDEBAR_TOGGLE_SHORTCUT_EVENT, handleSidebarToggleShortcut);
      window.removeEventListener(PROVIDER_LOADING_EVENT, handleProviderLoadingEvent as EventListener);
      window.removeEventListener('keydown', handleTabShortcut);
      cancelPendingFrames();
    };
  }, [
    createTab,
    closeTab,
    applyTabToRuntime,
    cancelPendingFrames,
    enqueueLayoutSync,
    persistUiSettings,
    runtime,
    scheduleResizeLayoutSync,
    setActiveTabState,
    setProviderLoadingState,
    switchTab,
    toggleCollapse,
    trimProviderLoadingState,
    updateTabsState,
  ]);

  const sidebarStyle = useMemo(() => {
    return {
      width: isElectronRuntime ? '100%' : `${configuredSidebarWidth}px`,
      '--sidebar-transition-duration': `${sidebarTransitionDurationMs}ms`,
      ...getSidebarThemeVars(ACTIVE_THEME_PRESET),
    } as CSSProperties;
  }, [configuredSidebarWidth, isElectronRuntime, sidebarTransitionDurationMs]);

  const contextValue = useMemo(() => {
    return {
      tabs,
      activeTabId,
      paneCount,
      activeProviders,
      providerLoadingByPane,
      createTab,
      switchTab,
      closeTab,
      setPaneCount,
      newAll,
      setProvider,
      syncPromptDraft,
      sendPrompt,
      removeQueuedPromptItem,
      removeQueuedPromptRound,
      clearQueuedPrompts,
    };
  }, [
    activeProviders,
    activeTabId,
    clearQueuedPrompts,
    closeTab,
    createTab,
    newAll,
    paneCount,
    providerLoadingByPane,
    removeQueuedPromptItem,
    removeQueuedPromptRound,
    sendPrompt,
    setPaneCount,
    setProvider,
    switchTab,
    syncPromptDraft,
    tabs,
  ]);

  return (
    <SidebarContextProvider value={contextValue}>
      <aside
        className={`sidebar${collapsed ? ' collapsed' : ''}${isCompactSidebar ? ' is-compact' : ''}${isTightSidebar ? ' is-tight' : ''}`}
        style={sidebarStyle}
      >
        <div className="sidebar-header">
          <span className="sidebar-title">LAZY LLM</span>
          <button
            type="button"
            className="collapse-btn"
            title="Toggle sidebar (Ctrl+B)"
            onClick={() => {
              void toggleCollapse();
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="11 17 6 12 11 7" />
              <polyline points="18 17 13 12 18 7" />
            </svg>
          </button>
        </div>

        <div className="sidebar-content">
          <div className="sidebar-scroll">
            <TabsBar />
            <PaneSelector />
            <ProviderList />
            <QuickPromptQueue />
          </div>
        </div>
      </aside>
    </SidebarContextProvider>
  );
}
