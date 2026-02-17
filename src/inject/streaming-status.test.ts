import { afterEach, describe, expect, it, vi } from 'vitest';
import { isComplete, isStreaming } from './streaming-status';

type SelectorDocument = Pick<Document, 'querySelector'>;

function createMockElement(options?: {
  hiddenAttr?: boolean;
  ariaHidden?: boolean;
  hiddenClass?: boolean;
}): Element {
  const hiddenAttr = options?.hiddenAttr === true;
  const ariaHidden = options?.ariaHidden === true;
  const hiddenClass = options?.hiddenClass === true;

  return {
    hasAttribute(name: string): boolean {
      return hiddenAttr && name === 'hidden';
    },
    getAttribute(name: string): string | null {
      if (ariaHidden && name === 'aria-hidden') {
        return 'true';
      }
      return null;
    },
    classList: {
      contains(token: string): boolean {
        return hiddenClass && token === 'hidden';
      },
    },
  } as unknown as Element;
}

function stubQuerySelector(
  selectorToElement: Record<string, Element | null>,
): void {
  const querySelector = vi.fn((selector: string) => {
    return selectorToElement[selector] ?? null;
  });
  vi.stubGlobal('document', { querySelector } as SelectorDocument);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('streaming-status visibility checks', () => {
  it('treats hidden streaming indicator as not streaming', () => {
    stubQuerySelector({
      '[data-streaming]': createMockElement({ hiddenClass: true }),
    });

    expect(isStreaming(['[data-streaming]'])).toBe(false);
  });

  it('treats visible streaming indicator as streaming', () => {
    stubQuerySelector({
      '[data-streaming]': createMockElement(),
    });

    expect(isStreaming(['[data-streaming]'])).toBe(true);
  });

  it('allows completion when streaming indicator exists but is hidden', () => {
    stubQuerySelector({
      '[data-streaming]': createMockElement({ ariaHidden: true }),
      '[data-complete]': createMockElement(),
    });

    expect(isComplete(['[data-streaming]'], ['[data-complete]'])).toBe(true);
  });
});
