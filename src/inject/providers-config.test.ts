import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { providersConfig, type ProviderInjectConfig } from './providers-config';

type SelectorProbeCategory = 'input' | 'submit' | 'extract' | 'streaming' | 'complete';

interface SelectorProbe {
  category: SelectorProbeCategory;
  selector: string;
  required: boolean;
}

interface ParityManifestEntry {
  provider: string;
  selectorProbes: SelectorProbe[];
}

function normalizeSelector(selector: string): string {
  return selector.replaceAll('"', "'").replace(/\s+/g, ' ').trim();
}

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

  it('required parity probes are covered by runtime provider selectors', () => {
    const manifestPath = resolve(process.cwd(), 'tests/fixtures/mock-site/parity-manifest.json');
    const entries = JSON.parse(readFileSync(manifestPath, 'utf8')) as ParityManifestEntry[];

    const categoryToConfigKey: Record<
      SelectorProbeCategory,
      keyof Pick<
        ProviderInjectConfig,
        'inputSelectors' | 'submitSelectors' | 'responseSelectors' | 'streamingIndicatorSelectors' | 'completeIndicatorSelectors'
      >
    > = {
      input: 'inputSelectors',
      submit: 'submitSelectors',
      extract: 'responseSelectors',
      streaming: 'streamingIndicatorSelectors',
      complete: 'completeIndicatorSelectors',
    };

    for (const entry of entries) {
      const providerConfig = providersConfig[entry.provider];
      expect(providerConfig).toBeDefined();

      for (const probe of entry.selectorProbes.filter((item) => item.required)) {
        const configKey = categoryToConfigKey[probe.category];
        const selectors = providerConfig[configKey] ?? [];
        const normalizedRuntimeSelectors = selectors.map(normalizeSelector);
        expect(
          normalizedRuntimeSelectors,
          `${entry.provider} is missing required ${probe.category} selector: ${probe.selector}`,
        ).toContain(normalizeSelector(probe.selector));
      }
    }
  });
});
