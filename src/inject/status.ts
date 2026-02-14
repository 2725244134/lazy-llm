import { findAllElements, isComplete, isStreaming } from './core';
import type { ProviderInjectConfig } from './providers-config';

export interface StatusResult {
  isStreaming: boolean;
  isComplete: boolean;
  hasResponse: boolean;
  provider: string;
}

export type BusyState = 'busy' | 'idle' | 'unknown';

export function resolveStatus(
  config: ProviderInjectConfig | undefined,
  provider: string
): StatusResult {
  if (!config) {
    return { isStreaming: false, isComplete: false, hasResponse: false, provider };
  }

  const streamingIndicatorSelectors = config.streamingIndicatorSelectors || [];
  const completeIndicatorSelectors = config.completeIndicatorSelectors || [];
  const hasResponse = Boolean(
    config.responseSelectors &&
    config.responseSelectors.length > 0 &&
    findAllElements(config.responseSelectors).length > 0
  );

  return {
    isStreaming: isStreaming(streamingIndicatorSelectors),
    isComplete: isComplete(streamingIndicatorSelectors, completeIndicatorSelectors),
    hasResponse,
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
