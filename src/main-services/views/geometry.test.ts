import { describe, expect, it } from 'vitest';
import { calculateLayout, validateLayout, type LayoutInput } from './geometry';

describe('calculateLayout', () => {
  it('computes sidebar and panes for 1 to 4 panes', () => {
    const baseInput = {
      windowWidth: 1000,
      windowHeight: 720,
      sidebarWidth: 280,
    };

    const cases: Array<{ paneCount: LayoutInput['paneCount']; expectedWidths: number[] }> = [
      { paneCount: 1, expectedWidths: [720] },
      { paneCount: 2, expectedWidths: [360, 360] },
      { paneCount: 3, expectedWidths: [240, 240, 240] },
      { paneCount: 4, expectedWidths: [180, 180, 180, 180] },
    ];

    for (const testCase of cases) {
      const input: LayoutInput = { ...baseInput, paneCount: testCase.paneCount };
      const result = calculateLayout(input);

      expect(result.sidebar).toEqual({
        x: 0,
        y: 0,
        width: 280,
        height: 720,
      });

      expect(result.panes.map((pane) => pane.width)).toEqual(testCase.expectedWidths);
      expect(validateLayout(input, result)).toBeNull();
    }
  });

  it('distributes remainder pixels to the first panes and keeps panes continuous', () => {
    const input: LayoutInput = {
      windowWidth: 1002,
      windowHeight: 640,
      sidebarWidth: 280,
      paneCount: 3,
    };

    const result = calculateLayout(input);
    const widths = result.panes.map((pane) => pane.width);
    const xs = result.panes.map((pane) => pane.x);

    expect(widths).toEqual([241, 241, 240]);
    expect(xs).toEqual([280, 521, 762]);
    expect(validateLayout(input, result)).toBeNull();
  });

  it('keeps panes minimally visible when content width equals pane count', () => {
    const input: LayoutInput = {
      windowWidth: 284,
      windowHeight: 500,
      sidebarWidth: 280,
      paneCount: 4,
    };

    const result = calculateLayout(input);
    expect(result.panes.map((pane) => pane.width)).toEqual([1, 1, 1, 1]);
    expect(validateLayout(input, result)).toBeNull();
  });
});

describe('validateLayout', () => {
  it('reports gaps between panes', () => {
    const input: LayoutInput = {
      windowWidth: 1000,
      windowHeight: 720,
      sidebarWidth: 280,
      paneCount: 2,
    };
    const valid = calculateLayout(input);
    const broken = {
      ...valid,
      panes: [
        valid.panes[0],
        {
          ...valid.panes[1],
          x: valid.panes[1].x + 1,
        },
      ],
    };

    expect(validateLayout(input, broken)).toContain('gap');
  });

  it('reports width sum mismatch', () => {
    const input: LayoutInput = {
      windowWidth: 1000,
      windowHeight: 720,
      sidebarWidth: 280,
      paneCount: 2,
    };
    const valid = calculateLayout(input);
    const broken = {
      ...valid,
      panes: [
        {
          ...valid.panes[0],
          width: valid.panes[0].width - 1,
        },
        valid.panes[1],
      ],
    };

    expect(validateLayout(input, broken)).toContain('Pane width sum');
  });
});
