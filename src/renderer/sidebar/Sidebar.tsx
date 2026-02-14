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
import { PaneSelector } from './PaneSelector';
import { ProviderList } from './ProviderList';
import { PromptComposer } from './PromptComposer';
import { type PaneCount, SidebarContextProvider } from './context';
import { resolveStartupState, saveUiSettings } from '../state/uiSettings';

const SIDEBAR_TOGGLE_SHORTCUT_EVENT = APP_CONFIG.interaction.shortcuts.sidebarToggleEvent;
const PROVIDER_LOADING_EVENT = APP_CONFIG.interaction.shortcuts.providerLoadingEvent;

function normalizePaneCount(count: number): PaneCount {
  const normalized = Math.min(
    APP_CONFIG.layout.pane.maxCount,
    Math.max(APP_CONFIG.layout.pane.minCount, Math.floor(count)),
  );
  return normalized as PaneCount;
}

const providerKeySet: Set<string> = new Set(
  APP_CONFIG.providers.catalog.map((provider) => provider.key),
);
const fallbackProvider = APP_CONFIG.providers.defaultPaneKeys[0] ?? 'chatgpt';

function normalizeProviderSequence(providers: readonly string[], paneCount: PaneCount): string[] {
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

export function Sidebar() {
  const runtime = useMemo(() => getSidebarRuntime(), []);

  const [collapsed, setCollapsed] = useState(false);
  const [paneCount, setPaneCountState] = useState<PaneCount>(
    APP_CONFIG.layout.pane.defaultCount as PaneCount,
  );
  const [activeProviders, setActiveProviders] = useState<string[]>([
    ...APP_CONFIG.providers.defaultActiveKeys,
  ]);
  const [providerLoadingByPane, setProviderLoadingByPane] = useState<Record<number, boolean>>({});
  const [expandedWidth, setExpandedWidth] = useState<number>(
    APP_CONFIG.layout.sidebar.defaultExpandedWidth,
  );

  const collapsedRef = useRef(collapsed);
  const paneCountRef = useRef(paneCount);
  const activeProvidersRef = useRef(activeProviders);
  const expandedWidthRef = useRef(expandedWidth);

  useEffect(() => {
    collapsedRef.current = collapsed;
  }, [collapsed]);

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

  const layoutSyncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lastLayoutSignatureRef = useRef<string | null>(null);
  const resizeRafRef = useRef(0);
  const focusRafRef = useRef(0);

  const persistUiSettings = useCallback((overrides?: {
    paneCount?: PaneCount;
    paneProviders?: string[];
    sidebarWidth?: number;
  }) => {
    saveUiSettings({
      version: 1,
      layout: {
        paneCount: overrides?.paneCount ?? paneCountRef.current,
        sidebarWidth: overrides?.sidebarWidth ?? expandedWidthRef.current,
      },
      providers: {
        paneKeys: overrides?.paneProviders ?? activeProvidersRef.current,
      },
    });
  }, []);

  const buildLayoutSignature = useCallback((panes: PaneCount, sidebarWidth: number): string => {
    return `${panes}:${sidebarWidth}`;
  }, []);

  const invalidateLayoutSignature = useCallback(() => {
    lastLayoutSignatureRef.current = null;
  }, []);

  const syncLayout = useCallback(async () => {
    const panes = paneCountRef.current;
    const sidebarWidth = collapsedRef.current ? collapsedWidth : expandedWidthRef.current;
    const viewportWidth = Math.max(1, Math.floor(window.innerWidth));
    const viewportHeight = Math.max(1, Math.floor(window.innerHeight));

    const signature = buildLayoutSignature(panes, sidebarWidth);
    if (signature === lastLayoutSignatureRef.current) {
      return;
    }

    await runtime.updateLayout({
      viewportWidth,
      viewportHeight,
      paneCount: panes,
      sidebarWidth,
    });

    lastLayoutSignatureRef.current = signature;
  }, [buildLayoutSignature, collapsedWidth, runtime]);

  const enqueueLayoutSync = useCallback(async () => {
    layoutSyncQueueRef.current = layoutSyncQueueRef.current
      .then(() => syncLayout())
      .catch((error) => {
        console.error('[Sidebar] syncLayout error:', error);
      });

    await layoutSyncQueueRef.current;
  }, [syncLayout]);

  const focusPromptComposer = useCallback(async () => {
    if (collapsedRef.current) {
      return;
    }

    if (focusRafRef.current !== 0) {
      window.cancelAnimationFrame(focusRafRef.current);
      focusRafRef.current = 0;
    }

    await new Promise<void>((resolve) => {
      focusRafRef.current = window.requestAnimationFrame(() => {
        focusRafRef.current = 0;

        const textarea = document.querySelector<HTMLTextAreaElement>('textarea.composer-textarea');
        if (textarea && !textarea.disabled) {
          textarea.focus();
          const cursorPosition = textarea.value.length;
          textarea.setSelectionRange(cursorPosition, cursorPosition);
        }

        resolve();
      });
    });
  }, []);

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

  const toggleCollapse = useCallback(async () => {
    const nextCollapsed = !collapsedRef.current;
    collapsedRef.current = nextCollapsed;
    setCollapsed(nextCollapsed);

    await enqueueLayoutSync();

    if (!nextCollapsed) {
      await focusPromptComposer();
    }
  }, [enqueueLayoutSync, focusPromptComposer]);

  const setPaneCount = useCallback(
    async (count: number) => {
      const oldCount = paneCountRef.current;
      const oldProviders = normalizeProviderSequence(activeProvidersRef.current, oldCount);

      const newCount = normalizePaneCount(count);
      if (newCount === oldCount) {
        return;
      }

      const nextProviders = normalizeProviderSequence(activeProvidersRef.current, newCount);

      paneCountRef.current = newCount;
      setPaneCountState(newCount);
      activeProvidersRef.current = nextProviders;
      setActiveProviders(nextProviders);

      try {
        await runtime.setPaneCount(newCount);
        trimProviderLoadingState(newCount);
        persistUiSettings({
          paneCount: newCount,
          paneProviders: nextProviders,
        });
      } catch (error) {
        invalidateLayoutSignature();
        paneCountRef.current = oldCount;
        setPaneCountState(oldCount);
        activeProvidersRef.current = oldProviders;
        setActiveProviders(oldProviders);
        trimProviderLoadingState(oldCount);
        console.error('[Sidebar] setPaneCount error:', error);
      }

      await enqueueLayoutSync();
    },
    [enqueueLayoutSync, invalidateLayoutSignature, persistUiSettings, runtime, trimProviderLoadingState],
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

      try {
        await runtime.updateProvider(paneIndex, providerKey);

        const nextProviders = normalizeProviderSequence(activeProvidersRef.current, paneCountRef.current);
        nextProviders[paneIndex] = providerKey;
        activeProvidersRef.current = nextProviders;
        setActiveProviders(nextProviders);

        persistUiSettings({
          paneProviders: nextProviders,
        });
      } catch (error) {
        setProviderLoadingState(paneIndex, false);
        console.error('[Sidebar] setProvider error:', error);
      }
    },
    [persistUiSettings, runtime, setProviderLoadingState],
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

  useEffect(() => {
    const handleWindowResize = () => {
      if (resizeRafRef.current !== 0) {
        return;
      }

      resizeRafRef.current = window.requestAnimationFrame(() => {
        resizeRafRef.current = 0;
        void enqueueLayoutSync();
      });
    };

    const handleSidebarToggleShortcut = () => {
      void toggleCollapse();
    };

    const handleProviderLoadingEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ paneIndex: number; loading: boolean }>).detail;
      if (
        !detail ||
        typeof detail.paneIndex !== 'number' ||
        !Number.isInteger(detail.paneIndex) ||
        detail.paneIndex < 0 ||
        typeof detail.loading !== 'boolean'
      ) {
        return;
      }

      setProviderLoadingState(detail.paneIndex, detail.loading);
    };

    let active = true;

    const initialize = async () => {
      try {
        const config = await runtime.getConfig();
        const startupState = resolveStartupState(config);

        if (!active) {
          return;
        }

        setExpandedWidth(startupState.sidebarWidth);
        expandedWidthRef.current = startupState.sidebarWidth;

        setPaneCountState(startupState.paneCount);
        paneCountRef.current = startupState.paneCount;

        setActiveProviders(startupState.paneProviders);
        activeProvidersRef.current = startupState.paneProviders;

        if (startupState.paneCount !== config.provider.pane_count) {
          await runtime.setPaneCount(startupState.paneCount);
        }

        for (let paneIndex = 0; paneIndex < startupState.paneCount; paneIndex += 1) {
          const targetProvider = startupState.paneProviders[paneIndex];
          const currentProvider = config.provider.panes[paneIndex];

          if (targetProvider !== currentProvider) {
            await runtime.updateProvider(paneIndex, targetProvider);
          }
        }

        persistUiSettings({
          paneCount: startupState.paneCount,
          paneProviders: startupState.paneProviders,
          sidebarWidth: startupState.sidebarWidth,
        });
      } catch (error) {
        console.error('[Sidebar] initialize error:', error);
      }

      if (!active) {
        return;
      }

      await enqueueLayoutSync();
      await focusPromptComposer();
    };

    window.addEventListener('resize', handleWindowResize);
    window.addEventListener(SIDEBAR_TOGGLE_SHORTCUT_EVENT, handleSidebarToggleShortcut);
    window.addEventListener(PROVIDER_LOADING_EVENT, handleProviderLoadingEvent as EventListener);

    void initialize();

    return () => {
      active = false;
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener(SIDEBAR_TOGGLE_SHORTCUT_EVENT, handleSidebarToggleShortcut);
      window.removeEventListener(PROVIDER_LOADING_EVENT, handleProviderLoadingEvent as EventListener);

      if (resizeRafRef.current !== 0) {
        window.cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = 0;
      }

      if (focusRafRef.current !== 0) {
        window.cancelAnimationFrame(focusRafRef.current);
        focusRafRef.current = 0;
      }
    };
  }, [enqueueLayoutSync, focusPromptComposer, persistUiSettings, runtime, setProviderLoadingState, toggleCollapse]);

  const sidebarStyle = useMemo(() => {
    return {
      width: isElectronRuntime ? '100%' : `${configuredSidebarWidth}px`,
      '--sidebar-transition-duration': `${sidebarTransitionDurationMs}ms`,
      ...getSidebarThemeVars(ACTIVE_THEME_PRESET),
    } as CSSProperties;
  }, [configuredSidebarWidth, isElectronRuntime, sidebarTransitionDurationMs]);

  const contextValue = useMemo(() => {
    return {
      paneCount,
      activeProviders,
      providerLoadingByPane,
      setPaneCount,
      newAll,
      setProvider,
      syncPromptDraft,
      sendPrompt,
    };
  }, [activeProviders, newAll, paneCount, providerLoadingByPane, sendPrompt, setPaneCount, setProvider, syncPromptDraft]);

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
            <PaneSelector />
            <ProviderList />
            <PromptComposer />
          </div>
        </div>
      </aside>
    </SidebarContextProvider>
  );
}
