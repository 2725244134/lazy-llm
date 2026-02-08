import type { ProviderMeta } from '../types'
import { APP_CONFIG } from '@/config'
import Icon from './icon.svg'

export const meta: ProviderMeta = { ...APP_CONFIG.providers.byKey.grok }

export { inject } from './inject'
export { Icon }
