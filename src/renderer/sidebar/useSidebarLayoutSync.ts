import {
  type MutableRefObject,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import type { SidebarRuntime } from '@/runtime/sidebar';
import type { PaneCount } from './context';

interface UseSidebarLayoutSyncArgs {
  runtime: SidebarRuntime;
  paneCountRef: MutableRefObject<PaneCount>;
  collapsedRef: MutableRefObject<boolean>;
  expandedWidthRef: MutableRefObject<number>;
  collapsedWidth: number;
}

interface SidebarLayoutSyncController {
  enqueueLayoutSync: () => Promise<void>;
  invalidateLayoutSignature: () => void;
  scheduleResizeLayoutSync: () => void;
  cancelPendingFrames: () => void;
}

function buildLayoutSignature(panes: PaneCount, sidebarWidth: number): string {
  return `${panes}:${sidebarWidth}`;
}

export function useSidebarLayoutSync(args: UseSidebarLayoutSyncArgs): SidebarLayoutSyncController {
  const {
    runtime,
    paneCountRef,
    collapsedRef,
    expandedWidthRef,
    collapsedWidth,
  } = args;

  const layoutSyncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lastLayoutSignatureRef = useRef<string | null>(null);
  const resizeRafRef = useRef(0);

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
  }, [collapsedRef, collapsedWidth, expandedWidthRef, paneCountRef, runtime]);

  const enqueueLayoutSync = useCallback(async () => {
    layoutSyncQueueRef.current = layoutSyncQueueRef.current
      .then(() => syncLayout())
      .catch((error) => {
        console.error('[Sidebar] syncLayout error:', error);
      });

    await layoutSyncQueueRef.current;
  }, [syncLayout]);

  const scheduleResizeLayoutSync = useCallback(() => {
    if (resizeRafRef.current !== 0) {
      return;
    }

    resizeRafRef.current = window.requestAnimationFrame(() => {
      resizeRafRef.current = 0;
      void enqueueLayoutSync();
    });
  }, [enqueueLayoutSync]);

  const cancelPendingFrames = useCallback(() => {
    if (resizeRafRef.current !== 0) {
      window.cancelAnimationFrame(resizeRafRef.current);
      resizeRafRef.current = 0;
    }
  }, []);

  return useMemo(() => {
    return {
      enqueueLayoutSync,
      invalidateLayoutSignature,
      scheduleResizeLayoutSync,
      cancelPendingFrames,
    };
  }, [
    cancelPendingFrames,
    enqueueLayoutSync,
    invalidateLayoutSignature,
    scheduleResizeLayoutSync,
  ]);
}
