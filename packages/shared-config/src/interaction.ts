export const INTERACTION_CONFIG = {
  shortcuts: {
    sidebarToggleEvent: 'lazyllm:shortcut-toggle-sidebar',
    providerLoadingEvent: 'lazyllm:provider-loading',
    quickPromptQueueEvent: 'lazyllm:quick-prompt-queue',
  },
  draftSync: {
    debounceMs: 90,
    sendClearGuardMs: 650,
  },
} as const;
