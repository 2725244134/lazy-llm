import type { ViewRect } from '../ipc/contracts.js';

interface ViewportSize {
  width: number;
  height: number;
}

export interface QuickPromptGeometryInput {
  viewport: ViewportSize;
  anchor: ViewRect;
  requestedHeight: number;
  passthroughMode: boolean;
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  viewportPadding: number;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

function normalizeViewport(viewport: ViewportSize): ViewportSize {
  return {
    width: Math.max(1, Math.floor(viewport.width)),
    height: Math.max(1, Math.floor(viewport.height)),
  };
}

function normalizeAnchor(anchor: ViewRect, viewport: ViewportSize): ViewRect {
  const x = clamp(Math.floor(anchor.x), 0, Math.max(0, viewport.width - 1));
  const y = clamp(Math.floor(anchor.y), 0, Math.max(0, viewport.height - 1));
  const width = clamp(Math.floor(anchor.width), 1, viewport.width - x);
  const height = clamp(Math.floor(anchor.height), 1, viewport.height - y);

  return { x, y, width, height };
}

export function calculateQuickPromptBounds(input: QuickPromptGeometryInput): ViewRect {
  const viewport = normalizeViewport(input.viewport);

  if (!input.passthroughMode) {
    return {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height,
    };
  }

  const anchor = normalizeAnchor(input.anchor, viewport);
  const padding = Math.max(0, Math.floor(input.viewportPadding));
  const configuredMinWidth = Math.max(1, Math.floor(input.minWidth));
  const configuredMaxWidth = Math.max(configuredMinWidth, Math.floor(input.maxWidth));
  const configuredMinHeight = Math.max(1, Math.floor(input.minHeight));
  const configuredMaxHeight = Math.max(configuredMinHeight, Math.floor(input.maxHeight));

  const availableWidth = Math.max(1, anchor.width - padding * 2);
  const minWidth = Math.min(configuredMinWidth, availableWidth);
  const width = clamp(configuredMaxWidth, minWidth, availableWidth);

  const availableHeight = Math.max(1, anchor.height - padding * 2);
  const minHeight = Math.min(configuredMinHeight, availableHeight);
  const requestedHeight = clamp(Math.ceil(input.requestedHeight), minHeight, configuredMaxHeight);
  const height = Math.min(requestedHeight, availableHeight);

  const centeredX = anchor.x + Math.floor((anchor.width - width) / 2);
  const centeredY = anchor.y + Math.floor((anchor.height - height) / 2);
  const minX = anchor.x + padding;
  const maxX = anchor.x + anchor.width - width - padding;
  const minY = anchor.y + padding;
  const maxY = anchor.y + anchor.height - height - padding;
  const anchoredX = clamp(centeredX, Math.min(minX, maxX), Math.max(minX, maxX));
  const anchoredY = clamp(centeredY, Math.min(minY, maxY), Math.max(minY, maxY));

  return {
    x: clamp(anchoredX, 0, viewport.width - width),
    y: clamp(anchoredY, 0, viewport.height - height),
    width,
    height,
  };
}
