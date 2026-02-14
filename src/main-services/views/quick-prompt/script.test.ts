import { describe, expect, it } from 'vitest';
import { QUICK_PROMPT_SCRIPT } from './script';

function extractOpenHandler(script: string): string {
  const start = script.indexOf("window.addEventListener('quick-prompt:open', () => {");
  const end = script.indexOf("window.addEventListener('quick-prompt:focus', () => {");
  if (start < 0 || end < 0 || end <= start) {
    return '';
  }
  return script.slice(start, end);
}

describe('quick prompt script', () => {
  it('preserves draft text when quick prompt opens', () => {
    const openHandler = extractOpenHandler(QUICK_PROMPT_SCRIPT);
    expect(openHandler).toContain('resetDraftSyncState();');
    expect(openHandler).not.toContain("input.value = '';");
  });

  it('still clears input after successful submit', () => {
    expect(QUICK_PROMPT_SCRIPT).toContain('await window.quickPrompt.sendPrompt(prompt);');
    expect(QUICK_PROMPT_SCRIPT).toContain("input.value = '';");
  });
});
