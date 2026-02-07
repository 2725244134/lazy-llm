import type { ProviderMeta } from '../../electron/ipc/contracts';

// Provider metadata
export const providerMetas: ProviderMeta[] = [
  { key: 'chatgpt', name: 'ChatGPT', url: 'https://chat.openai.com' },
  { key: 'claude', name: 'Claude', url: 'https://claude.ai' },
  { key: 'gemini', name: 'Gemini', url: 'https://gemini.google.com' },
  { key: 'grok', name: 'Grok', url: 'https://grok.x.ai' },
  { key: 'perplexity', name: 'Perplexity', url: 'https://perplexity.ai' },
  { key: 'copilot', name: 'Copilot', url: 'https://copilot.microsoft.com' },
];

// Index by key
export const providersByKey = Object.fromEntries(
  providerMetas.map((p) => [p.key, p])
);

// Default active providers
export const DEFAULT_ACTIVE_PROVIDERS = ['chatgpt', 'claude', 'gemini', 'grok'];

export type { ProviderMeta };
