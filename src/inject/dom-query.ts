import { reportFrontendError, toErrorMessage } from './error';

export function findElement(selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll<HTMLElement>(selector);
      for (const element of elements) {
        if (element.offsetParent !== null || window.getComputedStyle(element).display !== 'none') {
          return element;
        }
      }
    } catch (error) {
      reportFrontendError(
        'inject.findElement',
        `Selector failed (${selector}): ${toErrorMessage(error)}`,
        'inject'
      );
    }
  }

  return null;
}

export function findAllElements(selectors: string[]): HTMLElement[] {
  const results: HTMLElement[] = [];

  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll<HTMLElement>(selector);
      for (const element of elements) {
        if (!results.includes(element)) {
          results.push(element);
        }
      }
    } catch (error) {
      reportFrontendError(
        'inject.findAllElements',
        `Selector failed (${selector}): ${toErrorMessage(error)}`,
        'inject'
      );
    }
  }

  return results;
}
