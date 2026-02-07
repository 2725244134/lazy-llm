export interface PromptInjectionResult {
  success: boolean;
  reason?: string;
}

function normalizePromptText(text: string): string {
  const prompt = text.trim();
  if (!prompt) {
    throw new Error('prompt text cannot be empty');
  }
  return prompt;
}

export function buildPromptInjectionEvalScript(text: string): string {
  const prompt = normalizePromptText(text);
  const serializedPrompt = JSON.stringify(prompt);

  return `
(() => {
  const bridge = window.__llmBridge;
  if (!bridge || typeof bridge.injectPrompt !== "function") {
    return { success: false, reason: "window.__llmBridge.injectPrompt is unavailable" };
  }

  const result = bridge.injectPrompt(${serializedPrompt}, true);
  if (!result || result.success !== true) {
    const reason = result && typeof result.reason === "string"
      ? result.reason
      : "injectPrompt returned an unsuccessful result";
    return { success: false, reason };
  }

  return { success: true };
})();
`;
}
