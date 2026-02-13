import { APP_CONFIG } from '../../packages/shared-config/src/app.js';
import type { PaneCount } from './contracts.js';

export function validatePaneCount(count: unknown): PaneCount {
  if (typeof count !== 'number' || !Number.isInteger(count)) {
    return APP_CONFIG.layout.pane.defaultCount as PaneCount;
  }

  if (count < APP_CONFIG.layout.pane.minCount) {
    return APP_CONFIG.layout.pane.minCount as PaneCount;
  }

  if (count > APP_CONFIG.layout.pane.maxCount) {
    return APP_CONFIG.layout.pane.maxCount as PaneCount;
  }

  return count as PaneCount;
}

export function validateSidebarWidth(width: unknown): number {
  if (typeof width !== 'number' || !Number.isFinite(width)) {
    return APP_CONFIG.layout.sidebar.defaultExpandedWidth;
  }

  return Math.max(
    APP_CONFIG.layout.sidebar.minExpandedWidth,
    Math.min(APP_CONFIG.layout.sidebar.maxExpandedWidth, Math.floor(width)),
  );
}

export function validatePaneIndex(index: unknown, maxIndex: number): number | null {
  if (typeof index !== 'number' || !Number.isInteger(index)) {
    return null;
  }

  if (index < 0 || index > maxIndex) {
    return null;
  }

  return index;
}
