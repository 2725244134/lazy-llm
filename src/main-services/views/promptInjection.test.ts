import { describe, expect, test } from 'vitest';
import {
  buildPromptDraftSyncEvalScript,
  buildPromptImageAttachEvalScript,
  buildPromptInjectionEvalScript,
  buildPromptSubmitEvalScript,
  buildPromptStatusEvalScript,
} from './promptInjection';

describe('buildPromptInjectionEvalScript', () => {
  test('rejects empty prompt text', () => {
    expect(() => buildPromptInjectionEvalScript('   ')).toThrow('prompt text cannot be empty');
  });

  test('serializes prompt text safely for JavaScript execution', () => {
    const prompt = 'hello "llm"\nworld';
    const script = buildPromptInjectionEvalScript(prompt);

    expect(script).toContain(JSON.stringify(prompt));
    expect(script).toContain('bridge.injectPrompt');
    expect(script).toContain('return { success: true }');
  });

  test('allows explicit auto submit control', () => {
    const script = buildPromptInjectionEvalScript('hello', { autoSubmit: false });
    expect(script).toContain(', false)');
  });
});

describe('buildPromptDraftSyncEvalScript', () => {
  test('allows empty prompt draft text', () => {
    expect(() => buildPromptDraftSyncEvalScript('')).not.toThrow();
  });

  test('disables auto submit for draft sync', () => {
    const script = buildPromptDraftSyncEvalScript('draft');
    expect(script).toContain('bridge.injectPrompt');
    expect(script).toContain(', false)');
  });
});

describe('buildPromptStatusEvalScript', () => {
  test('checks bridge.getStatus availability', () => {
    const script = buildPromptStatusEvalScript();

    expect(script).toContain('bridge.getStatus');
    expect(script).toContain('window.__llmBridge.getStatus is unavailable');
  });

  test('validates status payload shape', () => {
    const script = buildPromptStatusEvalScript();

    expect(script).toContain('getStatus returned an invalid payload');
    expect(script).toContain('typeof status.isStreaming === "boolean"');
    expect(script).toContain('typeof status.isComplete === "boolean"');
    expect(script).toContain('typeof status.hasResponse === "boolean"');
  });
});

describe('buildPromptImageAttachEvalScript', () => {
  test('rejects invalid image payload', () => {
    expect(() => buildPromptImageAttachEvalScript({
      mimeType: '',
      base64Data: 'abc',
      sizeBytes: 1,
      source: 'clipboard',
    })).toThrow('prompt image mimeType must be a non-empty image/* string');
  });

  test('serializes image payload and calls bridge attachment API', () => {
    const script = buildPromptImageAttachEvalScript({
      mimeType: 'image/png',
      base64Data: 'QUJD',
      sizeBytes: 3,
      source: 'clipboard',
    });

    expect(script).toContain('bridge.attachImageFromClipboard');
    expect(script).toContain('"mimeType":"image/png"');
    expect(script).toContain('return { success: true }');
  });
});

describe('buildPromptSubmitEvalScript', () => {
  test('calls clickSubmitButton on bridge', () => {
    const script = buildPromptSubmitEvalScript();

    expect(script).toContain('bridge.clickSubmitButton');
    expect(script).toContain('clickSubmitButton returned an unsuccessful result');
  });
});
