import type { ProviderMeta } from '../types'
import Icon from './icon.svg'

export const meta: ProviderMeta = {
  key: 'aistudio',
  name: 'AI Studio',
  url: 'https://aistudio.google.com/prompts/new_chat',
}

export { inject } from './inject'
export { Icon }
