import { isComplete, isStreaming } from './core';
import type { ProviderInjectConfig } from './providers-config';

export interface StatusResult {
  isStreaming: boolean;
  isComplete: boolean;
  provider: string;
}

export type BusyState = 'busy' | 'idle' | 'unknown';

export function resolveStatus(
  config: ProviderInjectConfig | undefined,
  provider: string
): StatusResult {
  if (!config) {
    return { isStreaming: false, isComplete: false, provider };
  }

  const streamingIndicatorSelectors = config.streamingIndicatorSelectors || [];
  const completeIndicatorSelectors = config.completeIndicatorSelectors || [];

  return {
    isStreaming: isStreaming(streamingIndicatorSelectors),
    isComplete: isComplete(streamingIndicatorSelectors, completeIndicatorSelectors),
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

  return 'unknown';
}
