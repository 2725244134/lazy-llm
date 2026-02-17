import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { AppConfig } from '@shared-contracts/ipc/contracts';
import { APP_CONFIG } from '@shared-config/src/app.js';
import {
  normalizeProviderSequence as normalizeProviderSequenceByRule,
  padProviderSequence as padProviderSequenceByRule,
} from '@shared-config/src/providerSequence.js';

export const CANONICAL_PROVIDERS: AppConfig['provider']['catalog'] = [
  ...APP_CONFIG.providers.catalog.map((provider) => ({ ...provider })),
];

// Load mock providers from LAZYLLM_MOCK_PROVIDERS_FILE if set.
// If a mock key matches an existing provider, its URL is replaced in-place.
// Otherwise the mock entry is appended as a new provider.
const mockProvidersFile = process.env.LAZYLLM_MOCK_PROVIDERS_FILE;
if (mockProvidersFile && mockProvidersFile.trim().length > 0) {
  const configPath = resolve(process.cwd(), mockProvidersFile);
  if (existsSync(configPath)) {
    try {
      const mockConfig = JSON.parse(readFileSync(configPath, 'utf8'));
      for (const [key, config] of Object.entries(mockConfig as Record<string, Record<string, unknown>>)) {
        if (typeof config.url === 'string') {
          let url = config.url;
          // Resolve relative file:// URLs to absolute paths
          if (url.startsWith('file://./')) {
            url = `file://${resolve(process.cwd(), url.slice(7))}`;
          }
          // Replace existing provider URL if key matches
          const existing = CANONICAL_PROVIDERS.find((p) => p.key === key);
          if (existing) {
            (existing as { url: string }).url = url;
          } else {
            CANONICAL_PROVIDERS.push({
              key: key as string & keyof typeof APP_CONFIG.providers.byKey,
              name: key,
              url,
            });
          }
        }
      }
    } catch (error) {
      console.error('[providerConfig] Failed to load mock providers:', error);
    }
  }
}

const FALLBACK_PROVIDER_KEY =
  CANONICAL_PROVIDERS[0]?.key ?? APP_CONFIG.providers.catalog[0]?.key ?? 'chatgpt';

const VALID_PROVIDER_KEYS = CANONICAL_PROVIDERS.map((provider) => provider.key);

export function padProviderSequence(providers: readonly string[], paneCount: number): string[] {
  return padProviderSequenceByRule(providers, paneCount, FALLBACK_PROVIDER_KEY);
}

export function buildDefaultPaneProviders(paneCount: number): string[] {
  return padProviderSequenceByRule(APP_CONFIG.providers.defaultPaneKeys, paneCount, FALLBACK_PROVIDER_KEY);
}

export function normalizeProviderSequence(providers: unknown, paneCount: number): string[] {
  return normalizeProviderSequenceByRule(providers, paneCount, {
    validProviderKeys: VALID_PROVIDER_KEYS,
    fallbackProviderKey: FALLBACK_PROVIDER_KEY,
    fallbackStrategy: 'global',
  });
}
