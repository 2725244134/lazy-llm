import { APP_CONFIG } from '@/config';
import chatgptIcon from './chatgpt/icon.svg';
import claudeIcon from './claude/icon.svg';
import geminiIcon from './gemini/icon.svg';
import grokIcon from './grok/icon.svg';
import perplexityIcon from './perplexity/icon.svg';
import aistudioIcon from './aistudio/icon.svg';
import { providerRegistry, providerInjectConfigByKey } from './registry';

import type { ProviderMeta, ProviderInject, Provider } from './types';
export type { ProviderMeta, ProviderInject, Provider };

const providerIconsByKey: Record<string, string> = {
  chatgpt: chatgptIcon,
  claude: claudeIcon,
  gemini: geminiIcon,
  grok: grokIcon,
  perplexity: perplexityIcon,
  aistudio: aistudioIcon,
};

export const providers: Provider[] = providerRegistry.map((provider) => ({
  meta: provider.meta,
  inject: provider.inject,
  Icon: providerIconsByKey[provider.meta.key] ?? '',
}));

export const providersByKey = Object.fromEntries(
  providers.map((provider) => [provider.meta.key, provider]),
);

export const providerMetas = providers.map((provider) => provider.meta);

export const providerInjects = providerInjectConfigByKey;

export const providerIcons = Object.fromEntries(
  providers.map((provider) => [provider.meta.key, provider.Icon]),
) as Record<string, string>;

export const DEFAULT_ACTIVE_PROVIDERS = [...APP_CONFIG.providers.defaultActiveKeys];
