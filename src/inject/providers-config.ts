import { providerDetectRules, providerInjectConfigByKey } from '../providers/registry';
import type { ProviderInject } from '../providers/types';

export interface ProviderInjectConfig extends ProviderInject {
  urlPattern?: string;
}

export const providersConfig: Record<string, ProviderInjectConfig> = Object.fromEntries(
  Object.entries(providerInjectConfigByKey).map(([providerKey, providerInject]) => [
    providerKey,
    { ...providerInject },
  ]),
);

export { providerDetectRules };
