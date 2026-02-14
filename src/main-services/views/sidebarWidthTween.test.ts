import { describe, expect, it } from 'vitest';
import {
  clampProgress,
  computeSidebarWidthTweenFrame,
  easeOutCubic,
  normalizeSidebarWidth,
} from './sidebarWidthTween';

describe('sidebarWidthTween', () => {
  it('normalizes sidebar width into finite positive integers', () => {
    expect(normalizeSidebarWidth(Number.NaN)).toBe(1);
    expect(normalizeSidebarWidth(-10)).toBe(1);
    expect(normalizeSidebarWidth(120.9)).toBe(120);
  });

  it('clamps progress into the [0, 1] interval', () => {
    expect(clampProgress(Number.NaN)).toBe(0);
    expect(clampProgress(-0.5)).toBe(0);
    expect(clampProgress(0.75)).toBe(0.75);
    expect(clampProgress(2)).toBe(1);
  });

  it('uses an ease-out cubic progress curve', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });

  it('returns completion immediately when duration is zero', () => {
    const frame = computeSidebarWidthTweenFrame({
      fromWidth: 200,
      targetWidth: 40,
      elapsedMs: 0,
      durationMs: 0,
    });

    expect(frame).toEqual({
      width: 40,
      progress: 1,
      easedProgress: 1,
      isComplete: true,
    });
  });

  it('returns a bounded intermediate width while tween is active', () => {
    const frame = computeSidebarWidthTweenFrame({
      fromWidth: 200,
      targetWidth: 40,
      elapsedMs: 110,
      durationMs: 220,
    });

    expect(frame.isComplete).toBe(false);
    expect(frame.progress).toBe(0.5);
    expect(frame.width).toBeGreaterThan(40);
    expect(frame.width).toBeLessThan(200);
  });

  it('snaps to target width when elapsed time exceeds duration', () => {
    const frame = computeSidebarWidthTweenFrame({
      fromWidth: 40,
      targetWidth: 200,
      elapsedMs: 999,
      durationMs: 220,
    });

    expect(frame).toEqual({
      width: 200,
      progress: 1,
      easedProgress: 1,
      isComplete: true,
    });
  });
});
