import { providersConfig, providerDetectRules, type ProviderInjectConfig } from './providers-config';
import {
  findElement,
  injectText,
  isStreaming,
  isComplete,
  extractLastResponse,
  extractAllResponses,
} from './core';

interface InjectResult {
  success: boolean;
  reason?: string;
  provider?: string;
}

interface SubmitResult {
  success: boolean;
  reason?: string;
}

interface ExtractResult {
  success: boolean;
  response: string | null;
  isComplete: boolean;
  isStreaming: boolean;
  provider: string;
  reason?: string;
}

interface StatusResult {
  isStreaming: boolean;
  isComplete: boolean;
  provider: string;
}

declare global {
  interface Window {
    __llmBridge?: {
      provider: string;
      injectPrompt: (text: string, autoSubmit?: boolean) => InjectResult;
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

function getStatus(config: ProviderInjectConfig | undefined, provider: string): StatusResult {
  if (!config) {
    return { isStreaming: false, isComplete: false, provider };
  }

  return {
    isStreaming: isStreaming(config.streamingIndicatorSelectors || []),
    isComplete: isComplete(
      config.streamingIndicatorSelectors || [],
      config.completeIndicatorSelectors || []
    ),
    provider,
  };
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
    clickSubmitButton: () => clickSubmit(config),
    extractResponse: () => handleExtractResponse(config, provider),
    extractAllResponses: () => handleExtractAllResponses(config),
    getStatus: () => getStatus(config, provider),
    waitForComplete: (timeoutMs = 60000, pollIntervalMs = 500) =>
      waitForComplete(config, provider, timeoutMs, pollIntervalMs),
  };
})();
