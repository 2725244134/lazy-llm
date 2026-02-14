import { describe, expect, it } from 'vitest';
import { QUICK_PROMPT_STYLES } from './styles';

describe('quick prompt styles', () => {
  it('embeds theme variables from the active preset', () => {
    expect(QUICK_PROMPT_STYLES).toContain('--qp-surface:');
    expect(QUICK_PROMPT_STYLES).toContain('--qp-border-focus:');
    expect(QUICK_PROMPT_STYLES).toContain('--qp-scrollbar-thumb-hover:');
  });

  it('does not include system color scheme branching', () => {
    expect(QUICK_PROMPT_STYLES).not.toContain('prefers-color-scheme');
  });
});
