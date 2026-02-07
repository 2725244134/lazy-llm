import type { Component } from 'vue'

export interface ProviderMeta {
  key: string
  name: string
  url: string
}

export interface ProviderInject {
  // ===== Input =====
  inputSelectors: string[]
  submitSelectors: string[]

  // ===== Response extraction =====
  responseSelectors?: string[]
  streamingIndicatorSelectors?: string[]
  completeIndicatorSelectors?: string[]
  extractMode?: 'last' | 'all'

  // ===== Optional overrides =====
  handleInput?: (el: HTMLElement, text: string) => void
  detectComplete?: () => boolean
  extractResponse?: () => string | null
}

export interface Provider {
  meta: ProviderMeta
  inject: ProviderInject
  Icon: Component
}
