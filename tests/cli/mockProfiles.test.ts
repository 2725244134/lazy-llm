import { describe, expect, it } from 'vitest';
import type { MockProviderConfigFile, ParityManifestEntry } from '../../scripts/lib/mockTypes';
import { MOCK_PROFILES, SUPPORTED_PROVIDER_KEYS } from '../../scripts/lib/mockProfiles';

describe('mockProfiles', () => {
  it('exports profiles for chatgpt, grok, and gemini', () => {
    expect(SUPPORTED_PROVIDER_KEYS).toContain('chatgpt');
    expect(SUPPORTED_PROVIDER_KEYS).toContain('grok');
    expect(SUPPORTED_PROVIDER_KEYS).toContain('gemini');
  });

  it.each(SUPPORTED_PROVIDER_KEYS)('%s profile has all required selector fields', (key) => {
    const profile = MOCK_PROFILES[key];
    expect(profile).toBeDefined();
    expect(profile.key).toBe(key);
    expect(profile.name).toBeTruthy();
    expect(profile.realUrl).toMatch(/^https:\/\//);
    expect(profile.hostnames.length).toBeGreaterThan(0);
    expect(profile.inputSelectors.length).toBeGreaterThan(0);
    expect(profile.submitSelectors.length).toBeGreaterThan(0);
    expect(profile.responseSelectors.length).toBeGreaterThan(0);
    expect(profile.streamingIndicatorSelectors.length).toBeGreaterThan(0);
    expect(profile.completeIndicatorSelectors.length).toBeGreaterThan(0);
    expect(['last', 'all']).toContain(profile.extractMode);
  });
});

describe('mockTypes schema compliance', () => {
  it('MockProviderConfigFile validates a minimal config (url + urlPattern only)', () => {
    const config: MockProviderConfigFile = {
      chatgpt: {
        url: 'file://./tests/fixtures/mock-site/chatgpt-simulation.html',
        urlPattern: 'chatgpt-simulation.html',
      },
    };

    expect(config.chatgpt.urlPattern).toBe('chatgpt-simulation.html');
    expect(config.chatgpt.inputSelectors).toBeUndefined();
  });

  it('MockProviderConfigFile validates a config with optional selector overrides', () => {
    const config: MockProviderConfigFile = {
      chatgpt: {
        url: 'file://./tests/fixtures/mock-site/chatgpt-simulation.html',
        urlPattern: 'chatgpt-simulation.html',
        inputSelectors: ['div.ProseMirror#prompt-textarea'],
        extractMode: 'last',
      },
    };

    expect(config.chatgpt.inputSelectors).toHaveLength(1);
    expect(config.chatgpt.extractMode).toBe('last');
  });

  it('ParityManifestEntry validates a well-formed entry with real selectors', () => {
    const entry: ParityManifestEntry = {
      provider: 'chatgpt',
      structuralSelectors: [
        'div.ProseMirror#prompt-textarea',
        "button[data-testid='send-button']",
        "div[data-message-author-role='assistant'] .markdown",
      ],
      selectorProbes: [
        { category: 'input', selector: 'div.ProseMirror#prompt-textarea', required: true },
        { category: 'submit', selector: "button[data-testid='send-button']", required: true },
        { category: 'streaming', selector: "button[aria-label='Stop generating']", required: false },
        { category: 'complete', selector: "button[data-testid='copy-turn-action-button']", required: false },
        { category: 'extract', selector: "div[data-message-author-role='assistant'] .markdown", required: true },
      ],
    };

    expect(entry.selectorProbes).toHaveLength(5);
    expect(entry.selectorProbes.filter((p: { required: boolean }) => p.required)).toHaveLength(3);
  });
});
