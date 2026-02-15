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

interface WaitImageAttachmentReadyResult {
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
      waitForImageAttachmentReady: (
        timeoutMs?: number,
        pollIntervalMs?: number
      ) => Promise<WaitImageAttachmentReadyResult>;
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

const QUICK_PROMPT_INJECT_DEBUG_PREFIX = '[QuickPromptDebug][Inject]';

function logInjectDebug(message: string, details?: Record<string, unknown>): void {
  if (details === undefined) {
    console.info(QUICK_PROMPT_INJECT_DEBUG_PREFIX, message);
    return;
  }
  console.info(QUICK_PROMPT_INJECT_DEBUG_PREFIX, message, details);
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

function isSubmitButtonReady(button: HTMLElement): boolean {
  if (button instanceof HTMLButtonElement && button.disabled) {
    return false;
  }

  const disabledAttribute = button.getAttribute('disabled');
  if (disabledAttribute !== null) {
    return false;
  }

  const ariaDisabled = button.getAttribute('aria-disabled');
  if (typeof ariaDisabled === 'string' && ariaDisabled.toLowerCase() === 'true') {
    return false;
  }

  return true;
}

function waitForImageAttachmentReady(
  config: ProviderInjectConfig | undefined,
  provider: string,
  timeoutMs: number,
  pollIntervalMs: number
): Promise<WaitImageAttachmentReadyResult> {
  if (!config) {
    logInjectDebug('waitForImageAttachmentReady: missing provider config', { provider });
    return Promise.resolve({ success: false, reason: 'No config for provider', provider });
  }

  const normalizedTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : 3000;
  const normalizedPollIntervalMs = Number.isFinite(pollIntervalMs) && pollIntervalMs > 0
    ? pollIntervalMs
    : 120;
  const startedAtMs = Date.now();
  logInjectDebug('waitForImageAttachmentReady: polling started', {
    provider,
    timeoutMs: normalizedTimeoutMs,
    pollIntervalMs: normalizedPollIntervalMs,
  });

  return new Promise((resolve) => {
    let pollCount = 0;
    const poll = () => {
      pollCount += 1;
      const submitElement = findElement(config.submitSelectors);
      if (submitElement && isSubmitButtonReady(submitElement)) {
        logInjectDebug('waitForImageAttachmentReady: submit is ready', {
          provider,
          elapsedMs: Date.now() - startedAtMs,
          pollCount,
        });
        resolve({ success: true, provider });
        return;
      }

      if (Date.now() - startedAtMs >= normalizedTimeoutMs) {
        logInjectDebug('waitForImageAttachmentReady: timed out', {
          provider,
          elapsedMs: Date.now() - startedAtMs,
          pollCount,
        });
        resolve({
          success: false,
          reason: 'Timed out waiting for image attachment readiness',
          provider,
        });
        return;
      }

      setTimeout(poll, normalizedPollIntervalMs);
    };

    poll();
  });
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
    logInjectDebug('buildClipboardDataTransfer: DataTransfer constructor is unavailable');
    return null;
  }

  try {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    logInjectDebug('buildClipboardDataTransfer: DataTransfer created', {
      fileType: file.type,
      fileSizeBytes: file.size,
    });
    return dataTransfer;
  } catch (error) {
    logInjectDebug('buildClipboardDataTransfer: failed to build data transfer', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function dispatchSyntheticPaste(target: HTMLElement, dataTransfer: DataTransfer): boolean {
  let dispatched = false;
  let clipboardEventDispatched = false;
  let beforeInputDispatched = false;

  if (typeof ClipboardEvent === 'function') {
    try {
      const clipboardEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer,
      });
      target.dispatchEvent(clipboardEvent);
      dispatched = true;
      clipboardEventDispatched = true;
    } catch (error) {
      logInjectDebug('dispatchSyntheticPaste: ClipboardEvent dispatch failed', {
        error: error instanceof Error ? error.message : String(error),
      });
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
      beforeInputDispatched = true;
    } catch (error) {
      logInjectDebug('dispatchSyntheticPaste: beforeinput dispatch failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Best effort; continue to fallback events.
    }
  }

  logInjectDebug('dispatchSyntheticPaste: dispatch outcome', {
    targetTag: target.tagName,
    clipboardEventDispatched,
    beforeInputDispatched,
    dispatched,
  });
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
    logInjectDebug('handleAttachImageFromClipboard: invalid image payload', { provider });
    return { success: false, reason: 'Invalid clipboard image payload', provider };
  }
  logInjectDebug('handleAttachImageFromClipboard: payload accepted', {
    provider,
    mimeType: normalizedImage.mimeType,
    sizeBytes: normalizedImage.sizeBytes,
    base64Length: normalizedImage.base64Data.length,
  });

  const inputElement = findPromptInputElement(config);
  if (!inputElement) {
    logInjectDebug('handleAttachImageFromClipboard: input element not found', { provider });
    return { success: false, reason: 'Input element not found', provider };
  }
  logInjectDebug('handleAttachImageFromClipboard: target input resolved', {
    provider,
    tagName: inputElement.tagName,
    isContentEditable: inputElement.isContentEditable,
  });

  inputElement.focus();

  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(normalizedImage.base64Data);
    logInjectDebug('handleAttachImageFromClipboard: base64 decoded', {
      provider,
      byteLength: bytes.byteLength,
    });
  } catch (error) {
    logInjectDebug('handleAttachImageFromClipboard: base64 decode failed', {
      provider,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, reason: 'Invalid base64 image payload', provider };
  }

  const extension = inferImageExtension(normalizedImage.mimeType);
  const file = new File([bytes], `quickprompt-image.${extension}`, {
    type: normalizedImage.mimeType,
  });
  const dataTransfer = buildClipboardDataTransfer(file);
  if (!dataTransfer) {
    logInjectDebug('handleAttachImageFromClipboard: DataTransfer unavailable', {
      provider,
    });
    return { success: false, reason: 'DataTransfer is unavailable', provider };
  }

  const dispatched = dispatchSyntheticPaste(inputElement, dataTransfer);
  if (!dispatched) {
    logInjectDebug('handleAttachImageFromClipboard: synthetic paste not accepted', {
      provider,
    });
    return { success: false, reason: 'Programmatic paste events were ignored', provider };
  }

  logInjectDebug('handleAttachImageFromClipboard: synthetic paste dispatched', {
    provider,
    inputTag: inputElement.tagName,
  });
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
  logInjectDebug('bridge initialized', {
    provider,
    hasConfig: Boolean(config),
    hostname: window.location.hostname,
  });

  window.__llmBridge = {
    provider,
    injectPrompt: (text, autoSubmit = true) => handleInject(config, text, autoSubmit, provider),
    attachImageFromClipboard: (image) => handleAttachImageFromClipboard(config, image, provider),
    waitForImageAttachmentReady: (timeoutMs = 3000, pollIntervalMs = 120) =>
      waitForImageAttachmentReady(config, provider, timeoutMs, pollIntervalMs),
    clickSubmitButton: () => clickSubmit(config),
    extractResponse: () => handleExtractResponse(config, provider),
    extractAllResponses: () => handleExtractAllResponses(config),
    getStatus: () => resolveStatus(config, provider),
    waitForComplete: (timeoutMs = 60000, pollIntervalMs = 500) =>
      waitForComplete(config, provider, timeoutMs, pollIntervalMs),
  };
})();
