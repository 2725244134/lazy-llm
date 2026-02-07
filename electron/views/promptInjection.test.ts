import { describe, expect, test } from 'vitest';
import { buildPromptDraftSyncEvalScript, buildPromptInjectionEvalScript } from './promptInjection';

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
