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
    expect(openHandler).toContain('clearAttachedImage();');
    expect(openHandler).not.toContain("input.value = '';");
  });

  it('sends prompt payload with optional image and clears state after submit', () => {
    expect(QUICK_PROMPT_SCRIPT).toContain('await window.quickPrompt.sendPrompt({');
    expect(QUICK_PROMPT_SCRIPT).toContain('image: attachedImage ? { ...attachedImage } : null,');
    expect(QUICK_PROMPT_SCRIPT).toContain("input.value = '';");
    expect(QUICK_PROMPT_SCRIPT).toContain('clearAttachedImage();');
  });

  it('supports clipboard image paste with size guard', () => {
    expect(QUICK_PROMPT_SCRIPT).toContain("input?.addEventListener('paste', (event) => {");
    expect(QUICK_PROMPT_SCRIPT).toContain('MAX_CLIPBOARD_IMAGE_BYTES = 8 * 1024 * 1024;');
    expect(QUICK_PROMPT_SCRIPT).toContain('Image must be 8 MB or smaller.');
  });
});
