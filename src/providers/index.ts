import * as chatgpt from './chatgpt';
import * as claude from './claude';
import * as gemini from './gemini';
import * as grok from './grok';
import * as perplexity from './perplexity';
import * as aistudio from './aistudio';
import { APP_CONFIG } from '@/config';

import type { ProviderMeta, ProviderInject, Provider } from './types';
export type { ProviderMeta, ProviderInject, Provider };

export const providers = [chatgpt, claude, gemini, grok, perplexity, aistudio];

export const providersByKey = Object.fromEntries(providers.map((provider) => [provider.meta.key, provider]));

export const providerMetas = providers.map((provider) => provider.meta);

export const providerInjects = Object.fromEntries(
  providers.map((provider) => [provider.meta.key, provider.inject]),
);

export const providerIcons = Object.fromEntries(
  providers.map((provider) => [provider.meta.key, provider.Icon]),
) as Record<string, string>;

export const DEFAULT_ACTIVE_PROVIDERS = [...APP_CONFIG.providers.defaultActiveKeys];

export { chatgpt, claude, gemini, grok, perplexity, aistudio };
