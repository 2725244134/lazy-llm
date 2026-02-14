import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { AppConfig } from '@shared-contracts/ipc/contracts';
import { APP_CONFIG } from '@shared-config/src/app.js';

export const CANONICAL_PROVIDERS: AppConfig['provider']['catalog'] = [
  ...APP_CONFIG.providers.catalog.map((provider) => ({ ...provider })),
];

// Load mock providers from LAZYLLM_MOCK_PROVIDERS_FILE if set
const mockProvidersFile = process.env.LAZYLLM_MOCK_PROVIDERS_FILE;
if (mockProvidersFile && mockProvidersFile.trim().length > 0) {
  const configPath = resolve(process.cwd(), mockProvidersFile);
  if (existsSync(configPath)) {
    try {
      const mockConfig = JSON.parse(readFileSync(configPath, 'utf8'));
      for (const [key, config] of Object.entries(mockConfig as Record<string, Record<string, unknown>>)) {
        if (config.url) {
          let url = config.url as string;
          // Resolve relative file:// URLs to absolute paths
          if (url.startsWith('file://.')) {
            url = `file://${resolve(process.cwd(), url.slice(7))}`;
          }
          CANONICAL_PROVIDERS.push({
            key: key as string & keyof typeof APP_CONFIG.providers.byKey,
            name: key,
            url,
          });
        }
      }
    } catch (error) {
      console.error('[providerConfig] Failed to load mock providers:', error);
    }
  }
}

const FALLBACK_PROVIDER_KEY =
  CANONICAL_PROVIDERS[0]?.key ?? APP_CONFIG.providers.catalog[0]?.key ?? 'chatgpt';

const VALID_PROVIDER_KEYS = new Set(CANONICAL_PROVIDERS.map((provider) => provider.key));

export function padProviderSequence(providers: readonly string[], paneCount: number): string[] {
  const fallbackProvider = providers[0] ?? FALLBACK_PROVIDER_KEY;
  return Array.from({ length: paneCount }, (_, paneIndex) => {
    return providers[paneIndex] ?? fallbackProvider;
  });
}

export function buildDefaultPaneProviders(paneCount: number): string[] {
  return padProviderSequence(APP_CONFIG.providers.defaultPaneKeys, paneCount);
}

export function normalizeProviderSequence(providers: unknown, paneCount: number): string[] {
  const source = Array.isArray(providers) ? providers : [];

  return Array.from({ length: paneCount }, (_, paneIndex) => {
    const candidate = source[paneIndex];
    if (typeof candidate === 'string' && VALID_PROVIDER_KEYS.has(candidate)) {
      return candidate;
    }
    return FALLBACK_PROVIDER_KEY;
  });
}
