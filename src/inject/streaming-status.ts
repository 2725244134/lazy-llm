import { reportFrontendError, toErrorMessage } from './error';

function isIndicatorVisible(element: Element): boolean {
  if (element.classList?.contains?.('hidden')) {
    return false;
  }
  if (element.hasAttribute?.('hidden') || element.getAttribute?.('aria-hidden') === 'true') {
    return false;
  }

  if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
    return true;
  }

  const computed = window.getComputedStyle(element);
  return computed.display !== 'none'
    && computed.visibility !== 'hidden'
    && computed.visibility !== 'collapse'
    && computed.opacity !== '0';
}

export function isStreaming(indicatorSelectors: string[]): boolean {
  if (!indicatorSelectors || indicatorSelectors.length === 0) {
    return false;
  }

  for (const selector of indicatorSelectors) {
    try {
      const indicator = document.querySelector(selector);
      if (indicator && isIndicatorVisible(indicator)) {
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
        const indicator = document.querySelector(selector);
        if (indicator && isIndicatorVisible(indicator)) {
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
