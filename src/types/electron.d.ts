import type {
  HealthResponse,
  AppConfig,
  PaneCountRequest,
  PaneCountResponse,
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
  LayoutSnapshot,
} from '../../electron/ipc/contracts';

export interface CouncilAPI {
  healthCheck: () => Promise<HealthResponse>;
  getConfig: () => Promise<AppConfig>;
  setPaneCount: (request: PaneCountRequest) => Promise<PaneCountResponse>;
  updateProvider: (request: PaneUpdateRequest) => Promise<PaneUpdateResponse>;
  sendPrompt: (request: PromptRequest) => Promise<PromptResponse>;
  syncPromptDraft: (request: PromptSyncRequest) => Promise<PromptSyncResponse>;
  updateLayout: (request: LayoutUpdateRequest) => Promise<LayoutUpdateResponse>;
  getLayoutSnapshot: () => Promise<LayoutSnapshot>;
  updateSidebarWidth: (request: SidebarWidthRequest) => Promise<SidebarWidthResponse>;
  toggleQuickPrompt: () => Promise<QuickPromptToggleResponse>;
  hideQuickPrompt: () => Promise<QuickPromptHideResponse>;
  resizeQuickPrompt: (request: QuickPromptResizeRequest) => Promise<QuickPromptResizeResponse>;
}

declare global {
  interface Window {
    council: CouncilAPI;
  }
}

export {};
