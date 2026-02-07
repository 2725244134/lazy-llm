/**
 * IPC Contract Definitions
 * Single source of truth for all IPC channel names and payload types
 */

// Channel names - centralized to prevent magic strings
export const IPC_CHANNELS = {
  APP_HEALTH: 'app:health',
  CONFIG_GET: 'config:get',
  PANE_SET_COUNT: 'pane:setCount',
  PANE_UPDATE_PROVIDER: 'pane:updateProvider',
  PROMPT_SEND: 'prompt:send',
  PROMPT_SYNC_DRAFT: 'prompt:syncDraft',
  // Layout channels
  LAYOUT_UPDATE: 'layout:update',
  LAYOUT_GET_SNAPSHOT: 'layout:getSnapshot',
  SIDEBAR_UPDATE_WIDTH: 'sidebar:updateWidth',
  QUICK_PROMPT_TOGGLE: 'quickPrompt:toggle',
  QUICK_PROMPT_HIDE: 'quickPrompt:hide',
  QUICK_PROMPT_RESIZE: 'quickPrompt:resize',
  // Pane channels (main <-> pane)
  PANE_INJECT_PROMPT: 'pane:injectPrompt',
  PANE_RESPONSE_READY: 'pane:responseReady',
} as const;

// Type definitions for IPC payloads

export interface HealthResponse {
  ok: true;
  runtime: 'electron';
  version: string;
}

export interface AppConfig {
  sidebar: {
    expanded_width: number;
    collapsed_width: number;
  };
  defaults: {
    pane_count: number;
    providers: string[];
  };
  providers: ProviderMeta[];
}

export interface ProviderMeta {
  key: string;
  name: string;
  url: string;
}

export interface PaneCountRequest {
  count: 1 | 2 | 3 | 4;
}

export interface PaneCountResponse {
  success: boolean;
}

export interface PaneUpdateRequest {
  paneIndex: number;
  providerKey: string;
}

export interface PaneUpdateResponse {
  success: boolean;
  paneIndex: number;
}

export interface PromptRequest {
  text: string;
}

export interface PromptResponse {
  success: boolean;
  failures?: string[];
}

export interface PromptSyncRequest {
  text: string;
}

export interface PromptSyncResponse {
  success: boolean;
  failures?: string[];
}

// Layout types
export type PaneCount = 1 | 2 | 3 | 4;

export interface ViewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PaneState {
  paneIndex: number;
  bounds: ViewRect;
  providerKey: string;
  url: string;
}

export interface LayoutUpdateRequest {
  sidebarWidth: number;
  paneCount: PaneCount;
}

export interface LayoutUpdateResponse {
  success: boolean;
}

export interface LayoutSnapshot {
  windowWidth: number;
  windowHeight: number;
  sidebar: ViewRect;
  paneCount: PaneCount;
  quickPromptVisible: boolean;
  quickPromptBounds: ViewRect | null;
  panes: PaneState[];
}

export interface SidebarWidthRequest {
  width: number;
}

export interface SidebarWidthResponse {
  success: boolean;
}

export interface QuickPromptHideResponse {
  success: boolean;
  visible: boolean;
}

export interface QuickPromptToggleResponse {
  success: boolean;
  visible: boolean;
}

export interface QuickPromptResizeRequest {
  height: number;
}

export interface QuickPromptResizeResponse {
  success: boolean;
  visible: boolean;
  height: number;
}

// Pane injection types
export interface PaneInjectPromptPayload {
  text: string;
}

export interface PaneResponseReadyPayload {
  paneIndex: number;
  response: string;
}

// Structured error response
export interface IPCError {
  code: string;
  message: string;
  details?: unknown;
}

// Type-safe IPC contract mapping
export interface IPCContract {
  [IPC_CHANNELS.APP_HEALTH]: {
    request: void;
    response: HealthResponse;
  };
  [IPC_CHANNELS.CONFIG_GET]: {
    request: void;
    response: AppConfig;
  };
  [IPC_CHANNELS.PANE_SET_COUNT]: {
    request: PaneCountRequest;
    response: PaneCountResponse;
  };
  [IPC_CHANNELS.PANE_UPDATE_PROVIDER]: {
    request: PaneUpdateRequest;
    response: PaneUpdateResponse;
  };
  [IPC_CHANNELS.PROMPT_SEND]: {
    request: PromptRequest;
    response: PromptResponse;
  };
  [IPC_CHANNELS.PROMPT_SYNC_DRAFT]: {
    request: PromptSyncRequest;
    response: PromptSyncResponse;
  };
  [IPC_CHANNELS.LAYOUT_UPDATE]: {
    request: LayoutUpdateRequest;
    response: LayoutUpdateResponse;
  };
  [IPC_CHANNELS.LAYOUT_GET_SNAPSHOT]: {
    request: void;
    response: LayoutSnapshot;
  };
  [IPC_CHANNELS.SIDEBAR_UPDATE_WIDTH]: {
    request: SidebarWidthRequest;
    response: SidebarWidthResponse;
  };
  [IPC_CHANNELS.QUICK_PROMPT_HIDE]: {
    request: void;
    response: QuickPromptHideResponse;
  };
  [IPC_CHANNELS.QUICK_PROMPT_TOGGLE]: {
    request: void;
    response: QuickPromptToggleResponse;
  };
  [IPC_CHANNELS.QUICK_PROMPT_RESIZE]: {
    request: QuickPromptResizeRequest;
    response: QuickPromptResizeResponse;
  };
}
