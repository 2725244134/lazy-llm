import { findAllElements, isComplete, isStreaming } from './core';
import type { ProviderInjectConfig } from './providers-config';
import { findSendableSubmitButton } from './submit-button';

export interface StatusResult {
  isStreaming: boolean;
  isComplete: boolean;
  hasResponse: boolean;
  canSubmit: boolean;
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
      canSubmit: false,
      provider,
    };
  }

  const streamingIndicatorSelectors = config.streamingIndicatorSelectors || [];
  const completeIndicatorSelectors = config.completeIndicatorSelectors || [];
  const hasResponse = Boolean(
    config.responseSelectors &&
    config.responseSelectors.length > 0 &&
    findAllElements(config.responseSelectors).length > 0
  );
  const canSubmit = findSendableSubmitButton(config.submitSelectors) !== null;

  return {
    isStreaming: isStreaming(streamingIndicatorSelectors),
    isComplete: isComplete(streamingIndicatorSelectors, completeIndicatorSelectors),
    hasResponse,
    canSubmit,
    provider,
  };
}

export function resolveBusyState(status: StatusResult): BusyState {
  if (status.isStreaming) {
    return 'busy';
  }

  if (status.canSubmit) {
    return 'idle';
  }

  if (status.isComplete) {
    return 'idle';
  }

  if (!status.hasResponse) {
    return 'idle';
  }

  return 'unknown';
}
