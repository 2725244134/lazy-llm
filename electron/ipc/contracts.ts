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
}
