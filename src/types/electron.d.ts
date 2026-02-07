import type {
  HealthResponse,
  AppConfig,
  PaneCountRequest,
  PaneCountResponse,
  PaneUpdateRequest,
  PaneUpdateResponse,
  PromptRequest,
  PromptResponse,
  LayoutUpdateRequest,
  LayoutUpdateResponse,
  SidebarWidthRequest,
  SidebarWidthResponse,
  LayoutSnapshot,
} from '../../electron/ipc/contracts';

export interface CouncilAPI {
  healthCheck: () => Promise<HealthResponse>;
  getConfig: () => Promise<AppConfig>;
  setPaneCount: (request: PaneCountRequest) => Promise<PaneCountResponse>;
  updateProvider: (request: PaneUpdateRequest) => Promise<PaneUpdateResponse>;
  sendPrompt: (request: PromptRequest) => Promise<PromptResponse>;
  updateLayout: (request: LayoutUpdateRequest) => Promise<LayoutUpdateResponse>;
  getLayoutSnapshot: () => Promise<LayoutSnapshot>;
  updateSidebarWidth: (request: SidebarWidthRequest) => Promise<SidebarWidthResponse>;
}

declare global {
  interface Window {
    council: CouncilAPI;
  }
}

export {};
