import { describe, expect, it } from 'vitest';
import { providersConfig, type ProviderInjectConfig } from './providers-config';

describe('providers-config', () => {
  it('exports configs for all built-in providers', () => {
    expect(providersConfig.chatgpt).toBeDefined();
    expect(providersConfig.claude).toBeDefined();
    expect(providersConfig.gemini).toBeDefined();
    expect(providersConfig.grok).toBeDefined();
    expect(providersConfig.perplexity).toBeDefined();
    expect(providersConfig.aistudio).toBeDefined();
  });

  it('ProviderInjectConfig interface supports optional urlPattern', () => {
    const config: ProviderInjectConfig = {
      urlPattern: 'chatgpt-simulation.html',
      inputSelectors: ['#prompt-textarea'],
      submitSelectors: ['#send-btn'],
      responseSelectors: ['.content'],
      streamingIndicatorSelectors: ['.streaming'],
      extractMode: 'last',
    };

    expect(config.urlPattern).toBe('chatgpt-simulation.html');
  });

  it('built-in configs do not have urlPattern set', () => {
    for (const [_key, config] of Object.entries(providersConfig)) {
      expect(config.urlPattern).toBeUndefined();
    }
  });

  it.each(Object.entries(providersConfig))(
    '%s has inputSelectors and submitSelectors',
    (_key, config) => {
      expect(config.inputSelectors.length).toBeGreaterThan(0);
      expect(config.submitSelectors.length).toBeGreaterThan(0);
    },
  );
});
