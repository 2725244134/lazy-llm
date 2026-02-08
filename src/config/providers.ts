export type ProviderKey = 'chatgpt' | 'claude' | 'gemini' | 'grok' | 'perplexity' | 'aistudio';

export interface ProviderCatalogEntry {
  key: ProviderKey;
  name: string;
  url: string;
}

export const PROVIDER_CATALOG = [
  {
    key: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com/',
  },
  {
    key: 'claude',
    name: 'Claude',
    url: 'https://claude.ai/',
  },
  {
    key: 'gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com/',
  },
  {
    key: 'grok',
    name: 'Grok',
    url: 'https://grok.com/',
  },
  {
    key: 'perplexity',
    name: 'Perplexity',
    url: 'https://www.perplexity.ai/',
  },
  {
    key: 'aistudio',
    name: 'AI Studio',
    url: 'https://aistudio.google.com/prompts/new_chat',
  },
] as const satisfies readonly ProviderCatalogEntry[];

export const PROVIDER_CATALOG_BY_KEY = Object.freeze(
  Object.fromEntries(PROVIDER_CATALOG.map((provider) => [provider.key, provider])) as Record<
    ProviderKey,
    ProviderCatalogEntry
  >
);

export const DEFAULT_ACTIVE_PROVIDER_KEYS = [
  'chatgpt',
  'claude',
  'gemini',
  'grok',
] as const satisfies readonly ProviderKey[];

export const DEFAULT_PANE_PROVIDER_KEYS = [
  'chatgpt',
  'grok',
  'gemini'
] as const satisfies readonly ProviderKey[];
