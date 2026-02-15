import { describe, expect, it } from 'vitest';
import { QUICK_PROMPT_SCRIPT } from './script';

describe('quick prompt script', () => {
  it('builds runtime payload with serialized config', () => {
    expect(QUICK_PROMPT_SCRIPT).toContain('maxClipboardImageBytes');
    expect(QUICK_PROMPT_SCRIPT).toContain('draftSyncDebounceMs');
    expect(QUICK_PROMPT_SCRIPT).toContain('quickPromptRuntimeEntry');
  });

  it('preserves draft text when quick prompt opens', () => {
    expect(QUICK_PROMPT_SCRIPT).toContain('window.addEventListener("quick-prompt:open", () => {');
    expect(QUICK_PROMPT_SCRIPT).toContain('resetDraftSyncState();');
    expect(QUICK_PROMPT_SCRIPT).toContain('pendingPastedImage = null;');
  });

  it('sends prompt payload with optional image and clears state after submit', () => {
    expect(QUICK_PROMPT_SCRIPT).toContain('await window.quickPrompt.sendPrompt({');
    expect(QUICK_PROMPT_SCRIPT).toContain('image: pendingPastedImage ? { ...pendingPastedImage } : null');
    expect(QUICK_PROMPT_SCRIPT).toContain('input.value = ""');
    expect(QUICK_PROMPT_SCRIPT).toContain('pendingPastedImage = null;');
  });

  it('supports clipboard image paste with size guard', () => {
    expect(QUICK_PROMPT_SCRIPT).toContain('input?.addEventListener("paste", (event) => {');
    expect(QUICK_PROMPT_SCRIPT).toContain('maxClipboardImageBytes');
    expect(QUICK_PROMPT_SCRIPT).toContain('pendingPastedImage = null;');
  });
});
