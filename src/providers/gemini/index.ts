import type { ProviderMeta } from '../types'
import Icon from './icon.svg'

export const meta: ProviderMeta = {
  key: 'gemini',
  name: 'Gemini',
  url: 'https://gemini.google.com/',
}

export { inject } from './inject'
export { Icon }
