import type { ProviderMeta } from '../types'
import Icon from './icon.svg'

export const meta: ProviderMeta = {
  key: 'chatgpt',
  name: 'ChatGPT',
  url: 'https://chatgpt.com/',
}

export { inject } from './inject'
export { Icon }
