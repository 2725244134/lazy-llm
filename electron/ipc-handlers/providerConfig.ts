import type { AppConfig } from '../ipc/contracts.js';
import { APP_CONFIG } from '../../packages/shared-config/src/app.js';

export const CANONICAL_PROVIDERS: AppConfig['provider']['catalog'] = [
  ...APP_CONFIG.providers.catalog.map((provider) => ({ ...provider })),
];

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
