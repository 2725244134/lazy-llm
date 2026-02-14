import type { PromptImagePayload } from '@shared-contracts/ipc/contracts';

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

function normalizePromptImagePayload(image: PromptImagePayload): PromptImagePayload {
  if (!image || typeof image !== 'object') {
    throw new Error('prompt image payload must be an object');
  }

  if (typeof image.mimeType !== 'string' || image.mimeType.trim().length === 0) {
    throw new Error('prompt image mimeType must be a non-empty string');
  }

  if (typeof image.base64Data !== 'string' || image.base64Data.length === 0) {
    throw new Error('prompt image base64Data must be a non-empty string');
  }

  if (!Number.isFinite(image.sizeBytes) || image.sizeBytes <= 0) {
    throw new Error('prompt image sizeBytes must be a positive number');
  }

  if (image.source !== 'clipboard') {
    throw new Error('prompt image source must be clipboard');
  }

  return {
    mimeType: image.mimeType,
    base64Data: image.base64Data,
    sizeBytes: image.sizeBytes,
    source: image.source,
  };
}

export function buildPromptImageAttachEvalScript(image: PromptImagePayload): string {
  const normalizedImage = normalizePromptImagePayload(image);
  const serializedImage = JSON.stringify(normalizedImage);

  return `
(() => {
  const bridge = window.__llmBridge;
  if (!bridge || typeof bridge.attachImageFromClipboard !== "function") {
    return { success: false, reason: "window.__llmBridge.attachImageFromClipboard is unavailable" };
  }

  const result = bridge.attachImageFromClipboard(${serializedImage});
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
