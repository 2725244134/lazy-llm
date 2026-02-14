import { findAllElements, isComplete, isStreaming } from './core';
import type { ProviderInjectConfig } from './providers-config';

export interface StatusResult {
  isStreaming: boolean;
  isComplete: boolean;
  hasResponse: boolean;
  responseCount: number;
  lastResponseTextLength: number;
  provider: string;
}

export type BusyState = 'busy' | 'idle' | 'unknown';

export function resolveStatus(
  config: ProviderInjectConfig | undefined,
  provider: string
): StatusResult {
  if (!config) {
    return {
      isStreaming: false,
      isComplete: false,
      hasResponse: false,
      responseCount: 0,
      lastResponseTextLength: 0,
      provider,
    };
  }

  const streamingIndicatorSelectors = config.streamingIndicatorSelectors || [];
  const completeIndicatorSelectors = config.completeIndicatorSelectors || [];
  const responseElements = config.responseSelectors && config.responseSelectors.length > 0
    ? findAllElements(config.responseSelectors)
    : [];
  const responseCount = responseElements.length;
  const hasResponse = responseCount > 0;
  const lastResponseElement = responseCount > 0
    ? responseElements[responseCount - 1]
    : null;
  const lastResponseText = lastResponseElement
    ? (lastResponseElement.innerText || lastResponseElement.textContent || '').trim()
    : '';

  return {
    isStreaming: isStreaming(streamingIndicatorSelectors),
    isComplete: isComplete(streamingIndicatorSelectors, completeIndicatorSelectors),
    hasResponse,
    responseCount,
    lastResponseTextLength: lastResponseText.length,
    provider,
  };
}

export function resolveBusyState(status: StatusResult): BusyState {
  if (status.isStreaming) {
    return 'busy';
  }

  if (status.isComplete) {
    return 'idle';
  }

  if (!status.hasResponse) {
    return 'idle';
  }

  return 'unknown';
}
