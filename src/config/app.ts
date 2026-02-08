import { INTERACTION_CONFIG } from './interaction';
import { LAYOUT_CONFIG } from './layout';
import {
  DEFAULT_ACTIVE_PROVIDER_KEYS,
  DEFAULT_PANE_PROVIDER_KEYS,
  PROVIDER_CATALOG,
  PROVIDER_CATALOG_BY_KEY,
} from './providers';
import { RUNTIME_CONFIG } from './runtime';

export const APP_CONFIG = Object.freeze({
  layout: LAYOUT_CONFIG,
  interaction: INTERACTION_CONFIG,
  runtime: RUNTIME_CONFIG,
  providers: {
    catalog: PROVIDER_CATALOG,
    byKey: PROVIDER_CATALOG_BY_KEY,
    defaultActiveKeys: DEFAULT_ACTIVE_PROVIDER_KEYS,
    defaultPaneKeys: DEFAULT_PANE_PROVIDER_KEYS,
  },
});
