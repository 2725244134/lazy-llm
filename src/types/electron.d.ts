import type {
  HealthResponse,
  AppConfig,
  PaneCountRequest,
  PaneCountResponse,
  PaneResetAllResponse,
  PaneUpdateRequest,
  PaneUpdateResponse,
  PromptRequest,
  PromptResponse,
  PromptSyncRequest,
  PromptSyncResponse,
  LayoutUpdateRequest,
  LayoutUpdateResponse,
  SidebarWidthRequest,
  SidebarWidthResponse,
  QuickPromptToggleResponse,
  QuickPromptHideResponse,
  QuickPromptResizeRequest,
  QuickPromptResizeResponse,
} from '@shared-contracts/ipc/contracts';

export interface LazyLLMAPI {
  healthCheck: () => Promise<HealthResponse>;
  getConfig: () => Promise<AppConfig>;
  setPaneCount: (request: PaneCountRequest) => Promise<PaneCountResponse>;
  resetAllPanes: () => Promise<PaneResetAllResponse>;
  updateProvider: (request: PaneUpdateRequest) => Promise<PaneUpdateResponse>;
  sendPrompt: (request: PromptRequest) => Promise<PromptResponse>;
  syncPromptDraft: (request: PromptSyncRequest) => Promise<PromptSyncResponse>;
  updateLayout: (request: LayoutUpdateRequest) => Promise<LayoutUpdateResponse>;
  updateSidebarWidth: (request: SidebarWidthRequest) => Promise<SidebarWidthResponse>;
  toggleQuickPrompt: () => Promise<QuickPromptToggleResponse>;
  hideQuickPrompt: () => Promise<QuickPromptHideResponse>;
  resizeQuickPrompt: (request: QuickPromptResizeRequest) => Promise<QuickPromptResizeResponse>;
}

declare global {
  interface Window {
    lazyllm: LazyLLMAPI;
  }
}

export {};
