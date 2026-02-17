import { APP_CONFIG, normalizeProviderSequence } from '@/config';

const CATALOG_PROVIDER_KEYS = APP_CONFIG.providers.catalog.map((provider) => provider.key);
const FALLBACK_PROVIDER_KEY =
  APP_CONFIG.providers.defaultPaneKeys[0] ?? CATALOG_PROVIDER_KEYS[0] ?? 'chatgpt';

export function normalizePaneProviderSequence(
  providers: unknown,
  paneCount: number,
): string[] {
  return normalizeProviderSequence(providers, paneCount, {
    validProviderKeys: CATALOG_PROVIDER_KEYS,
    fallbackProviderKey: FALLBACK_PROVIDER_KEY,
    fallbackStrategy: 'first-valid-source',
  });
}
