import { reportFrontendError, toErrorMessage } from './error';

function hasHiddenClass(element: Element): boolean {
  const maybeClassList = element as Element & {
    classList?: { contains?: (token: string) => boolean };
  };
  return maybeClassList.classList?.contains?.('hidden') === true;
}

function hasHiddenAttribute(element: Element): boolean {
  const maybeElement = element as Element & {
    hasAttribute?: (qualifiedName: string) => boolean;
    getAttribute?: (qualifiedName: string) => string | null;
  };

  if (maybeElement.hasAttribute?.('hidden') === true) {
    return true;
  }

  return maybeElement.getAttribute?.('aria-hidden') === 'true';
}

function isStyleVisible(element: Element): boolean {
  if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
    return true;
  }

  const computed = window.getComputedStyle(element);
  if (computed.display === 'none') {
    return false;
  }
  if (computed.visibility === 'hidden' || computed.visibility === 'collapse') {
    return false;
  }
  if (computed.opacity === '0') {
    return false;
  }

  return true;
}

function isIndicatorVisible(element: Element): boolean {
  if (hasHiddenAttribute(element) || hasHiddenClass(element)) {
    return false;
  }
  return isStyleVisible(element);
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
