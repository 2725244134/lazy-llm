export type ProviderFallbackStrategy = 'global' | 'first-valid-source';

export interface NormalizeProviderSequenceOptions {
  validProviderKeys: readonly string[] | ReadonlySet<string>;
  fallbackProviderKey: string;
  fallbackStrategy?: ProviderFallbackStrategy;
}

function normalizePaneCount(paneCount: number): number {
  if (!Number.isFinite(paneCount) || paneCount <= 0) {
    return 1;
  }
  return Math.floor(paneCount);
}

function resolveValidProviderSet(validProviderKeys: readonly string[] | ReadonlySet<string>): Set<string> {
  if (validProviderKeys instanceof Set) {
    return new Set(validProviderKeys);
  }
  return new Set(validProviderKeys);
}

function resolveGlobalFallback(validProviderSet: Set<string>, fallbackProviderKey: string): string {
  if (validProviderSet.has(fallbackProviderKey)) {
    return fallbackProviderKey;
  }
  const firstValidProvider = validProviderSet.values().next().value;
  if (typeof firstValidProvider === 'string') {
    return firstValidProvider;
  }
  return fallbackProviderKey;
}

function resolveFirstSourceFallback(source: unknown[], validProviderSet: Set<string>, globalFallback: string): string {
  const firstSourceProvider = source[0];
  if (typeof firstSourceProvider === 'string' && validProviderSet.has(firstSourceProvider)) {
    return firstSourceProvider;
  }
  return globalFallback;
}

export function padProviderSequence(
  providers: readonly string[],
  paneCount: number,
  fallbackProviderKey: string,
): string[] {
  const normalizedPaneCount = normalizePaneCount(paneCount);
  const firstProvider = providers[0] ?? fallbackProviderKey;
  const fallback = typeof firstProvider === 'string' && firstProvider.length > 0
    ? firstProvider
    : fallbackProviderKey;

  return Array.from({ length: normalizedPaneCount }, (_, paneIndex) => {
    const candidate = providers[paneIndex];
    return typeof candidate === 'string' && candidate.length > 0 ? candidate : fallback;
  });
}

export function normalizeProviderSequence(
  providers: unknown,
  paneCount: number,
  options: NormalizeProviderSequenceOptions,
): string[] {
  const normalizedPaneCount = normalizePaneCount(paneCount);
  const source = Array.isArray(providers) ? providers : [];
  const validProviderSet = resolveValidProviderSet(options.validProviderKeys);
  const globalFallback = resolveGlobalFallback(validProviderSet, options.fallbackProviderKey);
  const fallback = options.fallbackStrategy === 'first-valid-source'
    ? resolveFirstSourceFallback(source, validProviderSet, globalFallback)
    : globalFallback;

  return Array.from({ length: normalizedPaneCount }, (_, paneIndex) => {
    const candidate = source[paneIndex];
    if (typeof candidate === 'string' && validProviderSet.has(candidate)) {
      return candidate;
    }
    return fallback;
  });
}
