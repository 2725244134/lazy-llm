import { describe, expect, it } from 'vitest';
import {
  ACTIVE_THEME_PRESET,
  getQuickPromptThemeVars,
  getSidebarThemeVars,
  renderCssVariableBlock,
} from './palette';

describe('theme palette', () => {
  it('provides rose pine sidebar variables', () => {
    const vars = getSidebarThemeVars(ACTIVE_THEME_PRESET);

    expect(vars['--bg']).toBe('#ffffff');
    expect(vars['--broadcast']).toBe('#d7827e');
    expect(vars['--input-focus-ring']).toContain('rgba');
  });

  it('renders css variable block for quick prompt variables', () => {
    const vars = getQuickPromptThemeVars(ACTIVE_THEME_PRESET);
    const cssBlock = renderCssVariableBlock(vars);

    expect(cssBlock).toContain('--qp-surface');
    expect(cssBlock).toContain('--qp-border-focus');
    expect(cssBlock).toContain('--qp-scrollbar-thumb-hover');
  });
});
