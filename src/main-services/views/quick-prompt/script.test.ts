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
    expect(QUICK_PROMPT_SCRIPT).toContain('imageCaptureTasks.clear();');
  });

  it('sends text prompt after waiting for in-flight image attachment tasks', () => {
    expect(QUICK_PROMPT_SCRIPT).toContain('await window.quickPrompt.sendPrompt({');
    expect(QUICK_PROMPT_SCRIPT).toContain('if (imageCaptureTasks.size > 0) {');
    expect(QUICK_PROMPT_SCRIPT).toContain('await Promise.all(Array.from(imageCaptureTasks));');
    expect(QUICK_PROMPT_SCRIPT).toContain('text: prompt');
    expect(QUICK_PROMPT_SCRIPT).toContain('input.value = ""');
    expect(QUICK_PROMPT_SCRIPT).not.toContain('pendingPastedImage');
  });

  it('supports clipboard image paste with immediate provider image injection', () => {
    expect(QUICK_PROMPT_SCRIPT).toContain('input?.addEventListener("paste", (event) => {');
    expect(QUICK_PROMPT_SCRIPT).toContain('maxClipboardImageBytes');
    expect(QUICK_PROMPT_SCRIPT).toContain('captureImageFromSystemClipboard');
    expect(QUICK_PROMPT_SCRIPT).toContain('readClipboardImage');
    expect(QUICK_PROMPT_SCRIPT).toContain('dispatchClipboardImagePayload');
    expect(QUICK_PROMPT_SCRIPT).toContain('attachPromptImage');
    expect(QUICK_PROMPT_SCRIPT).toContain('trackImageCapture(attachClipboardImage(file));');
    expect(QUICK_PROMPT_SCRIPT).toContain('trackImageCapture(fallbackCaptureTask);');
  });
});
