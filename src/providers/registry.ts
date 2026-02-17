import { APP_CONFIG } from '../config/app';
import { inject as chatgptInject } from './chatgpt/inject';
import { inject as claudeInject } from './claude/inject';
import { inject as geminiInject } from './gemini/inject';
import { inject as grokInject } from './grok/inject';
import { inject as perplexityInject } from './perplexity/inject';
import { inject as aistudioInject } from './aistudio/inject';
import type { ProviderInject, ProviderMeta } from './types';

type ProviderRegistryKey = keyof typeof APP_CONFIG.providers.byKey;

interface ProviderInjectByKey extends Record<ProviderRegistryKey, ProviderInject> {}

const providerInjectByKey: ProviderInjectByKey = {
  chatgpt: chatgptInject,
  claude: claudeInject,
  gemini: geminiInject,
  grok: grokInject,
  perplexity: perplexityInject,
  aistudio: aistudioInject,
};

const detectHostnameAliases: Partial<Record<ProviderRegistryKey, readonly string[]>> = {
  aistudio: ['ai.google.dev'],
};

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
}

function extractHostname(url: string): string | null {
  try {
    const parsed = new URL(url);
    const normalized = normalizeHostname(parsed.hostname);
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

function buildDetectHostnames(key: ProviderRegistryKey): string[] {
  const meta = APP_CONFIG.providers.byKey[key];
  const primaryHostname = extractHostname(meta.url);
  const aliases = detectHostnameAliases[key] ?? [];
  const allHostnames = [
    ...(primaryHostname ? [primaryHostname] : []),
    ...aliases.map((hostname) => normalizeHostname(hostname)).filter((hostname) => hostname.length > 0),
  ];
  return Array.from(new Set(allHostnames));
}

export interface ProviderRegistryEntry {
  meta: ProviderMeta;
  inject: ProviderInject;
  detectHostnames: readonly string[];
}

export const providerRegistry: ProviderRegistryEntry[] = (
  Object.keys(providerInjectByKey) as ProviderRegistryKey[]
).map((key) => {
  return {
    meta: { ...APP_CONFIG.providers.byKey[key] },
    inject: providerInjectByKey[key],
    detectHostnames: buildDetectHostnames(key),
  };
});

export const providerInjectConfigByKey = Object.fromEntries(
  providerRegistry.map((provider) => [provider.meta.key, { ...provider.inject }]),
) as Record<string, ProviderInject>;

export const providerDetectRules: Array<{ hostname: string; provider: string }> = providerRegistry.flatMap(
  (provider) => provider.detectHostnames.map((hostname) => ({ hostname, provider: provider.meta.key })),
);
