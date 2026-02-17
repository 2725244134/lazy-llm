import { providersConfig, providerDetectRules, type ProviderInjectConfig } from './providers-config';
import {
  findElement,
  injectText,
  isStreaming,
  isComplete,
  extractLastResponse,
  extractAllResponses,
} from './core';
import { resolveStatus, type StatusResult } from './status';
import { findSendableSubmitButton } from './submit-button';

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
    __lazyllm_extra_config?: Record<string, ProviderInjectConfig>;
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
  // Check extra (mock) configs first — urlPattern matching takes priority
  if (window.__lazyllm_extra_config) {
    for (const [key, config] of Object.entries(window.__lazyllm_extra_config)) {
      if (config.urlPattern && window.location.href.includes(config.urlPattern)) {
        return key;
      }
    }
  }

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

  const button = findSendableSubmitButton(config.submitSelectors);
  if (!button) {
    return { success: false, reason: 'No sendable submit button found' };
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

async function waitForComplete(
  config: ProviderInjectConfig | undefined,
  provider: string,
  timeoutMs: number,
  pollIntervalMs: number
): Promise<ExtractResult> {
  const deadline = Date.now() + timeoutMs;

  while (true) {
    const result = handleExtractResponse(config, provider);
    if (result.isComplete) {
      return result;
    }
    if (Date.now() > deadline) {
      return { ...result, success: false, reason: 'Timeout waiting for response completion' };
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

(() => {
  // Merge extra (mock) provider configs into the providers map.
  // Per-key spread ensures mock config only needs to specify overrides
  // (e.g. url + urlPattern) while real selectors from providers/*/inject.ts
  // are preserved for any field not explicitly overridden.
  if (window.__lazyllm_extra_config) {
    for (const [key, extraConfig] of Object.entries(window.__lazyllm_extra_config)) {
      if (providersConfig[key]) {
        providersConfig[key] = { ...providersConfig[key], ...extraConfig };
      } else {
        providersConfig[key] = extraConfig;
      }
    }
  }

  const provider = detectProvider();
  const config = providersConfig[provider];

  window.__llmBridge = {
    provider,
    injectPrompt: (text, autoSubmit = true) => handleInject(config, text, autoSubmit, provider),
    clickSubmitButton: () => clickSubmit(config),
    extractResponse: () => handleExtractResponse(config, provider),
    extractAllResponses: () => handleExtractAllResponses(config),
    getStatus: () => resolveStatus(config, provider),
    waitForComplete: (timeoutMs = 60000, pollIntervalMs = 500) =>
      waitForComplete(config, provider, timeoutMs, pollIntervalMs),
  };
})();
