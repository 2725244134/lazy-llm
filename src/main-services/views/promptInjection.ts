export interface PromptInjectionResult {
  success: boolean;
  reason?: string;
}

export interface PromptImageAttachResult {
  success: boolean;
  reason?: string;
}

export interface PromptStatusEvalResult {
  success: boolean;
  isStreaming?: boolean;
  isComplete?: boolean;
  hasResponse?: boolean;
  provider?: string;
  reason?: string;
}

export interface PromptInjectionScriptOptions {
  autoSubmit?: boolean;
}

function normalizePromptText(text: string): string {
  const prompt = text.trim();
  if (!prompt) {
    throw new Error('prompt text cannot be empty');
  }
  return prompt;
}

export function buildPromptInjectionEvalScript(
  text: string,
  options?: PromptInjectionScriptOptions
): string {
  const prompt = normalizePromptText(text);
  const serializedPrompt = JSON.stringify(prompt);
  const autoSubmit = options?.autoSubmit ?? true;
  const serializedAutoSubmit = JSON.stringify(autoSubmit);

  return `
(() => {
  const bridge = window.__llmBridge;
  if (!bridge || typeof bridge.injectPrompt !== "function") {
    return { success: false, reason: "window.__llmBridge.injectPrompt is unavailable" };
  }

  const result = bridge.injectPrompt(${serializedPrompt}, ${serializedAutoSubmit});
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

function normalizeDraftText(text: string): string {
  if (typeof text !== 'string') {
    throw new Error('prompt draft text must be a string');
  }
  return text;
}

export function buildPromptDraftSyncEvalScript(text: string): string {
  const promptDraft = normalizeDraftText(text);
  const serializedPromptDraft = JSON.stringify(promptDraft);

  return `
(() => {
  const bridge = window.__llmBridge;
  if (!bridge || typeof bridge.injectPrompt !== "function") {
    return { success: false, reason: "window.__llmBridge.injectPrompt is unavailable" };
  }

  const result = bridge.injectPrompt(${serializedPromptDraft}, false);
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

export function buildPromptImageAttachEvalScript(): string {
  return `
(() => {
  const bridge = window.__llmBridge;
  if (!bridge || typeof bridge.attachImageFromClipboard !== "function") {
    return { success: false, reason: "window.__llmBridge.attachImageFromClipboard is unavailable" };
  }

  const paneAPI = window.paneAPI;
  if (!paneAPI || typeof paneAPI.consumeStagedPromptImage !== "function") {
    return { success: false, reason: "window.paneAPI.consumeStagedPromptImage is unavailable" };
  }

  const image = paneAPI.consumeStagedPromptImage();
  if (!image) {
    return { success: false, reason: "no staged prompt image payload is available" };
  }

  const result = bridge.attachImageFromClipboard(image);
  if (!result || result.success !== true) {
    const reason = result && typeof result.reason === "string"
      ? result.reason
      : "attachImageFromClipboard returned an unsuccessful result";
    return { success: false, reason };
  }

  return { success: true };
})();
`;
}

export function buildPromptSubmitEvalScript(): string {
  return `
(() => {
  const bridge = window.__llmBridge;
  if (!bridge || typeof bridge.clickSubmitButton !== "function") {
    return { success: false, reason: "window.__llmBridge.clickSubmitButton is unavailable" };
  }

  const result = bridge.clickSubmitButton();
  if (!result || result.success !== true) {
    const reason = result && typeof result.reason === "string"
      ? result.reason
      : "clickSubmitButton returned an unsuccessful result";
    return { success: false, reason };
  }

  return { success: true };
})();
`;
}

export function buildPromptStatusEvalScript(): string {
  return `
(() => {
  const bridge = window.__llmBridge;
  if (!bridge || typeof bridge.getStatus !== "function") {
    return { success: false, reason: "window.__llmBridge.getStatus is unavailable" };
  }

  try {
    const status = bridge.getStatus();
    const isStreaming = status && typeof status.isStreaming === "boolean"
      ? status.isStreaming
      : null;
    const isComplete = status && typeof status.isComplete === "boolean"
      ? status.isComplete
      : null;
    const hasResponse = status && typeof status.hasResponse === "boolean"
      ? status.hasResponse
      : null;

    if (isStreaming === null || isComplete === null || hasResponse === null) {
      return { success: false, reason: "getStatus returned an invalid payload" };
    }

    const provider = status && typeof status.provider === "string"
      ? status.provider
      : "unknown";

    return {
      success: true,
      provider,
      isStreaming,
      isComplete,
      hasResponse,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { success: false, reason };
  }
})();
`;
}
