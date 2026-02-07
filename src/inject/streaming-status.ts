import { reportFrontendError, toErrorMessage } from './error';

export function isStreaming(indicatorSelectors: string[]): boolean {
  if (!indicatorSelectors || indicatorSelectors.length === 0) {
    return false;
  }

  for (const selector of indicatorSelectors) {
    try {
      if (document.querySelector(selector)) {
        return true;
      }
    } catch (error) {
      reportFrontendError(
        'inject.isStreaming',
        `Streaming indicator selector failed (${selector}): ${toErrorMessage(error)}`,
        'inject'
      );
    }
  }

  return false;
}

export function isComplete(streamingIndicators: string[], completeIndicators: string[]): boolean {
  if (isStreaming(streamingIndicators)) {
    return false;
  }

  if (completeIndicators && completeIndicators.length > 0) {
    for (const selector of completeIndicators) {
      try {
        if (document.querySelector(selector)) {
          return true;
        }
      } catch (error) {
        reportFrontendError(
          'inject.isComplete',
          `Complete indicator selector failed (${selector}): ${toErrorMessage(error)}`,
          'inject'
        );
      }
    }

    return false;
  }

  return true;
}
