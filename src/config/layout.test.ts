import { describe, expect, it } from 'vitest';
import { resolveSidebarUiDensity } from './layout';

describe('resolveSidebarUiDensity', () => {
  it('returns regular when width is above compact breakpoint', () => {
    expect(resolveSidebarUiDensity(260)).toBe('regular');
  });

  it('returns compact when width is between compact and tight breakpoints', () => {
    expect(resolveSidebarUiDensity(210)).toBe('compact');
  });

  it('returns tight when width is at or below tight breakpoint', () => {
    expect(resolveSidebarUiDensity(180)).toBe('tight');
    expect(resolveSidebarUiDensity(130)).toBe('tight');
  });

  it('falls back to regular when width is invalid', () => {
    expect(resolveSidebarUiDensity(Number.NaN)).toBe('regular');
  });
});
