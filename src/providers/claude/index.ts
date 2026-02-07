import type { ProviderMeta } from '../types'
import Icon from './icon.svg'

export const meta: ProviderMeta = {
  key: 'claude',
  name: 'Claude',
  url: 'https://claude.ai/',
}

export { inject } from './inject'
export { Icon }
