import { inject as chatgptInject } from '../providers/chatgpt/inject';
import { inject as claudeInject } from '../providers/claude/inject';
import { inject as geminiInject } from '../providers/gemini/inject';
import { inject as grokInject } from '../providers/grok/inject';
import { inject as perplexityInject } from '../providers/perplexity/inject';
import { inject as aistudioInject } from '../providers/aistudio/inject';

export interface ProviderInjectConfig {
  urlPattern?: string;
  inputSelectors: string[];
  submitSelectors: string[];
  responseSelectors?: string[];
  streamingIndicatorSelectors?: string[];
  completeIndicatorSelectors?: string[];
  extractMode?: 'last' | 'all';
}

export const providersConfig: Record<string, ProviderInjectConfig> = {
  chatgpt: chatgptInject,
  claude: claudeInject,
  gemini: geminiInject,
  grok: grokInject,
  perplexity: perplexityInject,
  aistudio: aistudioInject,
};

export const providerDetectRules: Array<{ hostname: string; provider: string }> = [
  { hostname: 'chatgpt.com', provider: 'chatgpt' },
  { hostname: 'claude.ai', provider: 'claude' },
  { hostname: 'gemini.google.com', provider: 'gemini' },
  { hostname: 'grok.com', provider: 'grok' },
  { hostname: 'perplexity.ai', provider: 'perplexity' },
  { hostname: 'aistudio.google.com', provider: 'aistudio' },
  { hostname: 'ai.google.dev', provider: 'aistudio' },
];
