import { APP_CONFIG } from '@shared-config/src/app.js';
import type { AppConfig, ProviderMeta } from '@shared-contracts/ipc/contracts';

export interface AppConfigPayloadInput {
  paneCount: number;
  paneProviders: readonly string[];
  providerCatalog: readonly ProviderMeta[];
  sidebarExpandedWidth: number;
  quickPromptHeight: number;
}

export function buildAppConfigPayload(input: AppConfigPayloadInput): AppConfig {
  return {
    provider: {
      pane_count: input.paneCount,
      panes: [...input.paneProviders],
      catalog: input.providerCatalog.map((provider) => ({ ...provider })),
    },
    sidebar: {
      expanded_width: input.sidebarExpandedWidth,
      // Collapsed width is fixed by product design and should not be mutated by user state.
      collapsed_width: APP_CONFIG.layout.sidebar.defaultCollapsedWidth,
    },
    quick_prompt: {
      default_height: input.quickPromptHeight,
    },
  };
}
