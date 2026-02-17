import { describe, expect, it } from 'vitest';
import { calculateQuickPromptBounds } from './geometry';

describe('calculateQuickPromptBounds', () => {
  it('fills the viewport when passthrough mode is disabled', () => {
    const bounds = calculateQuickPromptBounds({
      viewport: { width: 1400, height: 900 },
      anchor: { x: 280, y: 0, width: 1120, height: 900 },
      requestedHeight: 74,
      passthroughMode: false,
      minWidth: 280,
      maxWidth: 560,
      minHeight: 66,
      maxHeight: 320,
      viewportPadding: 16,
    });

    expect(bounds).toEqual({
      x: 0,
      y: 0,
      width: 1400,
      height: 900,
    });
  });

  it('centers the quick prompt within the anchor pane bounds', () => {
    const bounds = calculateQuickPromptBounds({
      viewport: { width: 1400, height: 900 },
      anchor: { x: 653, y: 0, width: 373, height: 900 },
      requestedHeight: 74,
      passthroughMode: true,
      minWidth: 280,
      maxWidth: 560,
      minHeight: 66,
      maxHeight: 320,
      viewportPadding: 16,
    });

    expect(bounds.x).toBeGreaterThanOrEqual(653);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(1026);
    expect(bounds.y).toBeGreaterThanOrEqual(16);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(884);
  });

  it('shrinks width and height to stay inside a narrow anchor', () => {
    const bounds = calculateQuickPromptBounds({
      viewport: { width: 900, height: 700 },
      anchor: { x: 600, y: 0, width: 120, height: 120 },
      requestedHeight: 300,
      passthroughMode: true,
      minWidth: 280,
      maxWidth: 560,
      minHeight: 66,
      maxHeight: 320,
      viewportPadding: 16,
    });

    expect(bounds.width).toBe(88);
    expect(bounds.height).toBe(88);
    expect(bounds.x).toBeGreaterThanOrEqual(600);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(720);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(120);
  });
});
