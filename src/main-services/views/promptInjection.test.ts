import { describe, expect, test } from 'vitest';
import {
  buildPromptDraftSyncEvalScript,
  buildPromptImageAttachEvalScript,
  buildPromptImageReadyWaitEvalScript,
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
  test('rejects empty consume token', () => {
    expect(() => buildPromptImageAttachEvalScript('   ')).toThrow(
      'prompt image consume token cannot be empty'
    );
  });

  test('consumes staged image payload through pane API before bridge attachment', () => {
    const script = buildPromptImageAttachEvalScript('consume-token');

    expect(script).toContain('bridge.attachImageFromClipboard');
    expect(script).toContain('paneAPI.consumeStagedPromptImage');
    expect(script).toContain('"consume-token"');
    expect(script).toContain('no staged prompt image payload is available');
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

describe('buildPromptImageReadyWaitEvalScript', () => {
  test('rejects invalid wait parameters', () => {
    expect(() => buildPromptImageReadyWaitEvalScript(0, 120)).toThrow(
      'prompt image readiness timeout must be a positive number'
    );
    expect(() => buildPromptImageReadyWaitEvalScript(3000, 0)).toThrow(
      'prompt image readiness poll interval must be a positive number'
    );
  });

  test('calls bridge waitForImageAttachmentReady with serialized values', () => {
    const script = buildPromptImageReadyWaitEvalScript(3000, 120);

    expect(script).toContain('bridge.waitForImageAttachmentReady');
    expect(script).toContain('(3000, 120)');
    expect(script).toContain('waitForImageAttachmentReady returned an unsuccessful result');
  });
});
