/**
 * Pure geometry calculation functions for layout
 */

import type { PaneCount, ViewRect } from '@shared-contracts/ipc/contracts';

export interface LayoutInput {
  windowWidth: number;
  windowHeight: number;
  sidebarWidth: number;
  paneCount: PaneCount;
}

export interface LayoutResult {
  sidebar: ViewRect;
  panes: ViewRect[];
}

/**
 * Calculate layout for sidebar and panes
 * All coordinates relative to window content area (0,0 at top-left)
 */
export function calculateLayout(input: LayoutInput): LayoutResult {
  const { windowWidth, windowHeight, sidebarWidth, paneCount } = input;

  // Sidebar bounds
  const sidebar: ViewRect = {
    x: 0,
    y: 0,
    width: Math.max(1, sidebarWidth),
    height: Math.max(1, windowHeight),
  };

  // Content area for panes
  const contentX = sidebarWidth;
  const contentWidth = Math.max(1, windowWidth - sidebarWidth);
  const contentHeight = Math.max(1, windowHeight);

  // Calculate pane widths with remainder distribution
  const baseWidth = Math.floor(contentWidth / paneCount);
  const remainder = contentWidth % paneCount;

  const panes: ViewRect[] = [];
  let currentX = contentX;

  for (let i = 0; i < paneCount; i++) {
    // Distribute remainder pixels to first panes
    const paneWidth = baseWidth + (i < remainder ? 1 : 0);

    panes.push({
      x: currentX,
      y: 0,
      width: paneWidth,
      height: contentHeight,
    });

    currentX += paneWidth;
  }

  return { sidebar, panes };
}

/**
 * Validate layout invariants
 * Returns null if valid, error message if invalid
 */
export function validateLayout(
  input: LayoutInput,
  result: LayoutResult
): string | null {
  const { windowWidth, sidebarWidth, paneCount } = input;
  const { sidebar, panes } = result;

  // Check pane count
  if (panes.length !== paneCount) {
    return `Pane count mismatch: expected ${paneCount}, got ${panes.length}`;
  }

  // Check sidebar position
  if (sidebar.x !== 0 || sidebar.y !== 0) {
    return `Sidebar must start at (0,0), got (${sidebar.x},${sidebar.y})`;
  }

  // Check sidebar width
  if (sidebar.width !== sidebarWidth) {
    return `Sidebar width mismatch: expected ${sidebarWidth}, got ${sidebar.width}`;
  }

  // Check continuous coverage
  const totalPaneWidth = panes.reduce((sum, p) => sum + p.width, 0);
  const expectedPaneWidth = windowWidth - sidebarWidth;
  if (totalPaneWidth !== expectedPaneWidth) {
    return `Pane width sum ${totalPaneWidth} !== expected ${expectedPaneWidth}`;
  }

  // Check no overlap and continuous
  for (let i = 0; i < panes.length; i++) {
    const pane = panes[i];

    // Check minimum size
    if (pane.width < 1 || pane.height < 1) {
      return `Pane ${i} has invalid size: ${pane.width}x${pane.height}`;
    }

    // Check first pane starts at sidebar edge
    if (i === 0 && pane.x !== sidebarWidth) {
      return `First pane must start at sidebarWidth ${sidebarWidth}, got ${pane.x}`;
    }

    // Check continuous with previous pane
    if (i > 0) {
      const prev = panes[i - 1];
      const expectedX = prev.x + prev.width;
      if (pane.x !== expectedX) {
        return `Pane ${i} gap: expected x=${expectedX}, got ${pane.x}`;
      }
    }
  }

  return null;
}
