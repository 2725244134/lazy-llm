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
  it('MockProviderConfigFile validates a well-formed config', () => {
    const config: MockProviderConfigFile = {
      chatgpt: {
        url: 'file://./tests/fixtures/mock-site/chatgpt-simulation.html',
        urlPattern: 'chatgpt-simulation.html',
        inputSelectors: ['#prompt-textarea'],
        submitSelectors: ['#send-btn'],
        responseSelectors: ['.message-row.assistant .content'],
        streamingIndicatorSelectors: ['.result-streaming'],
        extractMode: 'last',
      },
    };

    expect(config.chatgpt.inputSelectors).toHaveLength(1);
    expect(config.chatgpt.urlPattern).toBe('chatgpt-simulation.html');
  });

  it('ParityManifestEntry validates a well-formed entry', () => {
    const entry: ParityManifestEntry = {
      provider: 'chatgpt',
      structuralSelectors: ['#prompt-textarea', '#send-btn'],
      selectorProbes: [
        { category: 'input', selector: '#prompt-textarea', required: true },
        { category: 'submit', selector: '#send-btn', required: true },
        { category: 'streaming', selector: '.result-streaming', required: false },
      ],
    };

    expect(entry.selectorProbes).toHaveLength(3);
    expect(entry.selectorProbes.filter((p: { required: boolean }) => p.required)).toHaveLength(2);
  });
});
