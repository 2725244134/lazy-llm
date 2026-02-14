import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { AppConfig } from '@shared-contracts/ipc/contracts';
import { APP_CONFIG } from '@shared-config/src/app.js';

export const CANONICAL_PROVIDERS: AppConfig['provider']['catalog'] = [
  ...APP_CONFIG.providers.catalog.map((provider) => ({ ...provider })),
];

const extraProvidersFile = process.env.LAZYLLM_EXTRA_PROVIDERS_FILE;
if (extraProvidersFile && extraProvidersFile.trim().length > 0) {
  const extraConfigPath = resolve(process.cwd(), extraProvidersFile);
  if (existsSync(extraConfigPath)) {
    try {
      const extraConfig = JSON.parse(readFileSync(extraConfigPath, 'utf8'));
      for (const [key, config] of Object.entries(extraConfig as any)) {
        if ((config as any).url) {
          let url = (config as any).url;
          if (url.startsWith('file://.')) {
            url = `file://${resolve(process.cwd(), url.slice(7))}`;
          }
          CANONICAL_PROVIDERS.push({
            key: key as any,
            name: key,
            url,
          });
        }
      }
    } catch (error) {
      console.error('Failed to load extra providers', error);
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
