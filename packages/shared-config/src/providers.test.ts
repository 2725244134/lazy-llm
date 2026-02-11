import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ACTIVE_PROVIDER_KEYS,
  DEFAULT_PANE_PROVIDER_KEYS,
  PROVIDER_CATALOG,
  PROVIDER_CATALOG_BY_KEY,
} from './providers';

describe('provider defaults', () => {
  it('keeps provider keys unique in the catalog', () => {
    const keys = PROVIDER_CATALOG.map((provider) => provider.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('maps every catalog key to the same entry in byKey', () => {
    for (const provider of PROVIDER_CATALOG) {
      expect(PROVIDER_CATALOG_BY_KEY[provider.key]).toEqual(provider);
    }
  });

  it('ensures default active and pane keys exist in catalog', () => {
    const validKeys = new Set(PROVIDER_CATALOG.map((provider) => provider.key));

    for (const key of DEFAULT_ACTIVE_PROVIDER_KEYS) {
      expect(validKeys.has(key)).toBe(true);
    }
    for (const key of DEFAULT_PANE_PROVIDER_KEYS) {
      expect(validKeys.has(key)).toBe(true);
    }
  });
});
