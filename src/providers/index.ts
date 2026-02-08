import * as chatgpt from './chatgpt'
import * as claude from './claude'
import * as gemini from './gemini'
import * as grok from './grok'
import * as perplexity from './perplexity'
import * as aistudio from './aistudio'
import { APP_CONFIG } from '@/config'

import type { ProviderMeta, ProviderInject, Provider } from './types'
export type { ProviderMeta, ProviderInject, Provider }

// List of all providers
export const providers = [chatgpt, claude, gemini, grok, perplexity, aistudio]

// Index by key
export const providersByKey = Object.fromEntries(
  providers.map((p) => [p.meta.key, p])
)

// Export meta list (for the sidebar)
export const providerMetas = providers.map((p) => p.meta)

// Export inject configs (for inject.ts)
export const providerInjects = Object.fromEntries(
  providers.map((p) => [p.meta.key, p.inject])
)

// Export Icon components
export const providerIcons = Object.fromEntries(
  providers.map((p) => [p.meta.key, p.Icon])
)

// Default active providers
export const DEFAULT_ACTIVE_PROVIDERS = [...APP_CONFIG.providers.defaultActiveKeys]

// Re-export each provider
export { chatgpt, claude, gemini, grok, perplexity, aistudio }
