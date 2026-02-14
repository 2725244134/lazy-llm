export interface SidebarWidthTweenFrameInput {
  fromWidth: number;
  targetWidth: number;
  elapsedMs: number;
  durationMs: number;
}

export interface SidebarWidthTweenFrame {
  width: number;
  progress: number;
  easedProgress: number;
  isComplete: boolean;
}

export function normalizeSidebarWidth(width: number): number {
  if (!Number.isFinite(width)) {
    return 1;
  }
  return Math.max(1, Math.floor(width));
}

export function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0;
  }
  return Math.max(0, Math.min(1, progress));
}

export function easeOutCubic(progress: number): number {
  const clampedProgress = clampProgress(progress);
  return 1 - Math.pow(1 - clampedProgress, 3);
}

export function computeSidebarWidthTweenFrame(
  input: SidebarWidthTweenFrameInput
): SidebarWidthTweenFrame {
  const fromWidth = normalizeSidebarWidth(input.fromWidth);
  const targetWidth = normalizeSidebarWidth(input.targetWidth);
  const durationMs = Number.isFinite(input.durationMs)
    ? Math.max(0, Math.floor(input.durationMs))
    : 0;

  if (durationMs === 0 || fromWidth === targetWidth) {
    return {
      width: targetWidth,
      progress: 1,
      easedProgress: 1,
      isComplete: true,
    };
  }

  const elapsedMs = Number.isFinite(input.elapsedMs) ? input.elapsedMs : 0;
  const progress = clampProgress(elapsedMs / durationMs);
  const easedProgress = easeOutCubic(progress);
  const nextWidth = progress >= 1
    ? targetWidth
    : Math.round(fromWidth + (targetWidth - fromWidth) * easedProgress);

  return {
    width: normalizeSidebarWidth(nextWidth),
    progress,
    easedProgress,
    isComplete: progress >= 1,
  };
}
