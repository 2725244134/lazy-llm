import { afterEach, describe, expect, it, vi } from 'vitest';
import { providersConfig, type ProviderInjectConfig } from './providers-config';
import { resolveBusyState, resolveStatus } from './status';

type QuerySelectorImpl = (selector: string) => Element | null;
type QuerySelectorAllImpl = (selector: string) => Element[];

function withMockDocument(
  querySelectorImpl: QuerySelectorImpl,
  querySelectorAllImpl?: QuerySelectorAllImpl
): void {
  const querySelector = vi.fn(querySelectorImpl);
  const querySelectorAll = vi.fn((selector: string) => {
    if (querySelectorAllImpl) {
      return querySelectorAllImpl(selector);
    }

    const element = querySelectorImpl(selector);
    return element ? [element] : [];
  });
  vi.stubGlobal(
    'document',
    {
      querySelector,
      querySelectorAll,
    } as unknown as Document
  );
}

function mockQuerySelector(
  matchedSelectors: Set<string>,
  throwingSelectors: Set<string> = new Set()
): QuerySelectorImpl {
  return (selector: string) => {
    if (throwingSelectors.has(selector)) {
      throw new Error(`Invalid selector: ${selector}`);
    }

    if (matchedSelectors.has(selector)) {
      return {} as Element;
    }

    return null;
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('resolveStatus', () => {
  it('returns unknown-like status when provider config is unavailable', () => {
    const status = resolveStatus(undefined, 'unknown');

    expect(status).toEqual({
      isStreaming: false,
      isComplete: false,
      hasResponse: false,
      canSubmit: false,
      provider: 'unknown',
    });
    expect(resolveBusyState(status)).toBe('idle');
  });

  it('handles selector errors and continues evaluating remaining selectors', () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const config: ProviderInjectConfig = {
      inputSelectors: ['textarea'],
      submitSelectors: ['button[type="submit"]'],
      streamingIndicatorSelectors: ['[broken', '[data-streaming]'],
      completeIndicatorSelectors: ['[data-complete]'],
    };

    withMockDocument(
      mockQuerySelector(new Set(['[data-streaming]']), new Set(['[broken']))
    );

    const status = resolveStatus(config, 'synthetic');

    expect(status.isStreaming).toBe(true);
    expect(status.isComplete).toBe(false);
    expect(status.hasResponse).toBe(false);
    expect(resolveBusyState(status)).toBe('busy');
    expect(logger).toHaveBeenCalled();
  });

  const providerEntries = Object.entries(providersConfig);

  it.each(providerEntries)('%s has streaming selectors for busy detection', (_provider, config) => {
    expect(config.streamingIndicatorSelectors?.length ?? 0).toBeGreaterThan(0);
  });

  it('gemini complete selectors are scoped to latest response turn', () => {
    const geminiConfig = providersConfig.gemini;
    expect(geminiConfig.completeIndicatorSelectors?.length ?? 0).toBeGreaterThan(0);
    for (const selector of geminiConfig.completeIndicatorSelectors ?? []) {
      expect(selector).toContain('model-response:last-of-type');
    }
  });

  it('gemini streaming selectors include stop icon signal on latest response turn', () => {
    const geminiConfig = providersConfig.gemini;
    const selectors = geminiConfig.streamingIndicatorSelectors ?? [];
    expect(selectors).toContain("button[aria-label='Stop response']");
    expect(selectors).toContain('button.send-button.stop');
    expect(selectors).toContain('.send-button-container .stop-icon');
    expect(selectors).toContain("mat-icon[fonticon='stop']");
    expect(selectors).toContain("model-response:last-of-type mat-icon[fonticon='stop']");
  });

  it.each(providerEntries)('%s reports busy when streaming selector matches', (provider, config) => {
    const streamingSelector = config.streamingIndicatorSelectors?.[0];
    expect(streamingSelector).toBeTruthy();

    withMockDocument(mockQuerySelector(new Set([streamingSelector!])));

    const status = resolveStatus(config, provider);

    expect(status.provider).toBe(provider);
    expect(status.isStreaming).toBe(true);
    expect(status.isComplete).toBe(false);
    expect(status.hasResponse).toBe(false);
    expect(resolveBusyState(status)).toBe('busy');
  });

  it.each(providerEntries)('%s reports idle when complete selector matches and stream is absent', (provider, config) => {
    const completeSelector = config.completeIndicatorSelectors?.[0];
    expect(completeSelector).toBeTruthy();

    withMockDocument(mockQuerySelector(new Set([completeSelector!])));

    const status = resolveStatus(config, provider);

    expect(status.provider).toBe(provider);
    expect(status.isStreaming).toBe(false);
    expect(status.isComplete).toBe(true);
    expect(status.hasResponse).toBe(false);
    expect(resolveBusyState(status)).toBe('idle');
  });

  it.each(providerEntries)(
    '%s reports idle without response when neither stream nor complete selectors match',
    (provider, config) => {
      withMockDocument(mockQuerySelector(new Set()));

      const status = resolveStatus(config, provider);

      expect(status.provider).toBe(provider);
      expect(status.isStreaming).toBe(false);
      expect(status.hasResponse).toBe(false);

      if ((config.completeIndicatorSelectors?.length ?? 0) > 0) {
        expect(status.isComplete).toBe(false);
      } else {
        expect(status.isComplete).toBe(true);
      }
      expect(resolveBusyState(status)).toBe('idle');
    }
  );

  it.each(providerEntries)(
    '%s reports unknown when response exists but stream/complete markers are both absent',
    (provider, config) => {
      const responseSelector = config.responseSelectors?.[0];
      expect(responseSelector).toBeTruthy();

      withMockDocument(mockQuerySelector(new Set([responseSelector!])));

      const status = resolveStatus(config, provider);

      expect(status.provider).toBe(provider);
      expect(status.isStreaming).toBe(false);
      expect(status.hasResponse).toBe(true);

      const completeSelectors = config.completeIndicatorSelectors ?? [];
      const completeMatchesResponse = completeSelectors.includes(responseSelector!);
      if (completeMatchesResponse) {
        expect(status.isComplete).toBe(true);
        expect(resolveBusyState(status)).toBe('idle');
      } else {
        expect(status.isComplete).toBe(false);
        expect(resolveBusyState(status)).toBe('unknown');
      }
    }
  );

  it('reports idle when response exists and submit button is sendable', () => {
    const config: ProviderInjectConfig = {
      inputSelectors: ['textarea'],
      submitSelectors: ['button.send'],
      responseSelectors: ['.response'],
      streamingIndicatorSelectors: ['.streaming'],
      completeIndicatorSelectors: ['.complete'],
    };

    const sendButton = {
      tagName: 'BUTTON',
      disabled: false,
      type: 'button',
      offsetParent: {} as Element,
      className: 'send',
      textContent: 'Send',
      getAttribute: (name: string) => {
        if (name === 'aria-disabled') {
          return 'false';
        }
        if (name === 'aria-label') {
          return 'Send message';
        }
        return null;
      },
    } as unknown as Element;

    withMockDocument(
      mockQuerySelector(new Set(['.response'])),
      (selector) => {
        if (selector === '.response') {
          return [{} as Element];
        }
        if (selector === 'button.send') {
          return [sendButton];
        }
        return [];
      },
    );

    const status = resolveStatus(config, 'gemini');

    expect(status.isStreaming).toBe(false);
    expect(status.isComplete).toBe(false);
    expect(status.hasResponse).toBe(true);
    expect(status.canSubmit).toBe(true);
    expect(resolveBusyState(status)).toBe('idle');
  });
});
