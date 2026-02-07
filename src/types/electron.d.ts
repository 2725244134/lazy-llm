import type {
  HealthResponse,
  AppConfig,
  PaneCountRequest,
  PaneCountResponse,
  PaneUpdateRequest,
  PaneUpdateResponse,
  PromptRequest,
  PromptResponse,
} from '../../electron/ipc/contracts';

export interface CouncilAPI {
  healthCheck: () => Promise<HealthResponse>;
  getConfig: () => Promise<AppConfig>;
  setPaneCount: (request: PaneCountRequest) => Promise<PaneCountResponse>;
  updateProvider: (request: PaneUpdateRequest) => Promise<PaneUpdateResponse>;
  sendPrompt: (request: PromptRequest) => Promise<PromptResponse>;
}

declare global {
  interface Window {
    council: CouncilAPI;
  }
}

export {};
