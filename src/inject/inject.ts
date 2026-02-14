import { providersConfig, providerDetectRules, type ProviderInjectConfig } from './providers-config';
import type { PromptImagePayload } from '../../packages/shared-contracts/ipc/contracts';
import { normalizePromptImagePayload } from '../../packages/shared-contracts/ipc/promptImage';
import {
  findElement,
  injectText,
  isStreaming,
  isComplete,
  extractLastResponse,
  extractAllResponses,
} from './core';
import { resolveStatus, type StatusResult } from './status';

interface InjectResult {
  success: boolean;
  reason?: string;
  provider?: string;
}

interface SubmitResult {
  success: boolean;
  reason?: string;
}

interface AttachImageResult {
  success: boolean;
  reason?: string;
  provider?: string;
}

interface ExtractResult {
  success: boolean;
  response: string | null;
  isComplete: boolean;
  isStreaming: boolean;
  provider: string;
  reason?: string;
}

declare global {
  interface Window {
    __llmBridge?: {
      provider: string;
      injectPrompt: (text: string, autoSubmit?: boolean) => InjectResult;
      attachImageFromClipboard: (image: PromptImagePayload) => AttachImageResult;
      clickSubmitButton: () => SubmitResult;
      extractResponse: () => ExtractResult;
      extractAllResponses: () => string[];
      getStatus: () => StatusResult;
      waitForComplete: (
        timeoutMs?: number,
        pollIntervalMs?: number
      ) => Promise<ExtractResult>;
    };
  }
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
}

function hostnameMatches(hostname: string, ruleHostname: string): boolean {
  if (hostname === ruleHostname) {
    return true;
  }
  return hostname.endsWith(`.${ruleHostname}`);
}

function detectProvider(): string {
  const hostname = normalizeHostname(window.location.hostname);
  for (const rule of providerDetectRules) {
    const ruleHostname = normalizeHostname(rule.hostname);
    if (hostnameMatches(hostname, ruleHostname)) {
      return rule.provider;
    }
  }
  return 'unknown';
}

function clickSubmit(config: ProviderInjectConfig | undefined): SubmitResult {
  if (!config) {
    return { success: false, reason: 'No config' };
  }

  const button = findElement(config.submitSelectors) as HTMLButtonElement | null;
  if (!button) {
    return { success: false, reason: 'Submit button not found' };
  }

  if (button.disabled) {
    return { success: false, reason: 'Button disabled' };
  }

  button.click();
  return { success: true };
}

function decodeBase64(base64Data: string): Uint8Array {
  const decoded = atob(base64Data);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

function inferImageExtension(mimeType: string): string {
  const slashIndex = mimeType.indexOf('/');
  if (slashIndex < 0 || slashIndex === mimeType.length - 1) {
    return 'png';
  }
  return mimeType.slice(slashIndex + 1).replace(/[^\w.-]/g, '') || 'png';
}

function findPromptInputElement(config: ProviderInjectConfig | undefined): HTMLElement | null {
  if (config) {
    const bySelector = findElement(config.inputSelectors);
    if (bySelector) {
      return bySelector;
    }
  }

  if (document.activeElement instanceof HTMLElement) {
    return document.activeElement;
  }

  return null;
}

function buildClipboardDataTransfer(file: File): DataTransfer | null {
  if (typeof DataTransfer !== 'function') {
    return null;
  }

  try {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    return dataTransfer;
  } catch (_error) {
    return null;
  }
}

function dispatchSyntheticPaste(target: HTMLElement, dataTransfer: DataTransfer): boolean {
  let dispatched = false;

  if (typeof ClipboardEvent === 'function') {
    try {
      const clipboardEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer,
      });
      target.dispatchEvent(clipboardEvent);
      dispatched = true;
    } catch (_error) {
      // Best effort; continue to fallback events.
    }
  }

  if (typeof InputEvent === 'function') {
    try {
      const beforeInputEvent = new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertFromPaste',
        dataTransfer,
      });
      target.dispatchEvent(beforeInputEvent);
      dispatched = true;
    } catch (_error) {
      // Best effort; continue to fallback events.
    }
  }

  return dispatched;
}

function handleInject(
  config: ProviderInjectConfig | undefined,
  text: string,
  autoSubmit: boolean,
  provider: string
): InjectResult {
  if (!config) {
    return { success: false, reason: 'No config for provider', provider };
  }

  const inputElement = findElement(config.inputSelectors);
  if (!inputElement) {
    return { success: false, reason: 'Input element not found', provider };
  }

  const success = injectText(inputElement, text);
  if (!success) {
    return { success: false, reason: 'Unknown element type', provider };
  }

  if (autoSubmit) {
    setTimeout(() => clickSubmit(config), 300);
  }

  return { success: true, provider };
}

function handleAttachImageFromClipboard(
  config: ProviderInjectConfig | undefined,
  image: PromptImagePayload,
  provider: string
): AttachImageResult {
  const normalizedImage = normalizePromptImagePayload(image);
  if (!normalizedImage) {
    return { success: false, reason: 'Invalid clipboard image payload', provider };
  }

  const inputElement = findPromptInputElement(config);
  if (!inputElement) {
    return { success: false, reason: 'Input element not found', provider };
  }

  inputElement.focus();

  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(normalizedImage.base64Data);
  } catch (_error) {
    return { success: false, reason: 'Invalid base64 image payload', provider };
  }

  const extension = inferImageExtension(normalizedImage.mimeType);
  const file = new File([bytes], `quickprompt-image.${extension}`, {
    type: normalizedImage.mimeType,
  });
  const dataTransfer = buildClipboardDataTransfer(file);
  if (!dataTransfer) {
    return { success: false, reason: 'DataTransfer is unavailable', provider };
  }

  const dispatched = dispatchSyntheticPaste(inputElement, dataTransfer);
  if (!dispatched) {
    return { success: false, reason: 'Programmatic paste events were ignored', provider };
  }

  return { success: true, provider };
}

function handleExtractResponse(
  config: ProviderInjectConfig | undefined,
  provider: string
): ExtractResult {
  if (!config) {
    return {
      success: false,
      response: null,
      isComplete: false,
      isStreaming: false,
      provider,
      reason: 'No config for provider',
    };
  }

  if (!config.responseSelectors || config.responseSelectors.length === 0) {
    return {
      success: false,
      response: null,
      isComplete: false,
      isStreaming: false,
      provider,
      reason: 'No response selectors configured',
    };
  }

  const streamingStatus = isStreaming(config.streamingIndicatorSelectors || []);
  const completeStatus = isComplete(
    config.streamingIndicatorSelectors || [],
    config.completeIndicatorSelectors || []
  );
  const response = extractLastResponse(config.responseSelectors);

  return {
    success: response !== null,
    response,
    isComplete: completeStatus,
    isStreaming: streamingStatus,
    provider,
  };
}

function handleExtractAllResponses(config: ProviderInjectConfig | undefined): string[] {
  if (!config || !config.responseSelectors) {
    return [];
  }
  return extractAllResponses(config.responseSelectors);
}

async function waitForComplete(
  config: ProviderInjectConfig | undefined,
  provider: string,
  timeoutMs: number,
  pollIntervalMs: number
): Promise<ExtractResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const poll = () => {
      const result = handleExtractResponse(config, provider);

      if (result.isComplete) {
        resolve(result);
        return;
      }

      if (Date.now() - startTime > timeoutMs) {
        resolve({
          ...result,
          success: false,
          reason: 'Timeout waiting for response completion',
        });
        return;
      }

      setTimeout(poll, pollIntervalMs);
    };

    poll();
  });
}

(() => {
  const provider = detectProvider();
  const config = providersConfig[provider];

  window.__llmBridge = {
    provider,
    injectPrompt: (text, autoSubmit = true) => handleInject(config, text, autoSubmit, provider),
    attachImageFromClipboard: (image) => handleAttachImageFromClipboard(config, image, provider),
    clickSubmitButton: () => clickSubmit(config),
    extractResponse: () => handleExtractResponse(config, provider),
    extractAllResponses: () => handleExtractAllResponses(config),
    getStatus: () => resolveStatus(config, provider),
    waitForComplete: (timeoutMs = 60000, pollIntervalMs = 500) =>
      waitForComplete(config, provider, timeoutMs, pollIntervalMs),
  };
})();
