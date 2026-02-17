import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '@shared-contracts/ipc/contracts';
import type { IpcRuntimeContext } from '../context.js';
import { registerPromptIpcHandlers } from './prompt';

type PromptHandler = (event: unknown, request?: unknown) => Promise<unknown> | unknown;

interface PromptViewManagerLike {
  sendPromptToAll(request: unknown): Promise<{ success: boolean; failures?: string[] }>;
  attachPromptImageToAll(image: unknown): Promise<{ success: boolean; failures?: string[] }>;
  syncPromptDraftToAll(text: string): Promise<{ success: boolean; failures?: string[] }>;
  removeQueuedPromptItem(queueItemId: string): { success: boolean; removedCount: number; failures?: string[] };
  removeQueuedPromptRound(roundId: number): { success: boolean; removedCount: number; failures?: string[] };
  clearQueuedPrompts(): { success: boolean; removedCount: number; failures?: string[] };
}

const electronMocks = vi.hoisted(() => {
  const handlers = new Map<string, PromptHandler>();
  const handle = vi.fn((channel: string, handler: PromptHandler) => {
    handlers.set(channel, handler);
  });
  return {
    handlers,
    handle,
  };
});

vi.mock('electron', () => ({
  ipcMain: {
    handle: electronMocks.handle,
  },
}));

function createContext(viewManager: PromptViewManagerLike | null): IpcRuntimeContext {
  return {
    getViewManager: () => viewManager as ReturnType<IpcRuntimeContext['getViewManager']>,
    getConfig: () => ({} as ReturnType<IpcRuntimeContext['getConfig']>),
    setDefaultPaneCount: () => undefined,
    setDefaultProvider: () => undefined,
  };
}

function createViewManagerMock(overrides?: Partial<PromptViewManagerLike>): PromptViewManagerLike {
  return {
    sendPromptToAll: vi.fn().mockResolvedValue({ success: true, failures: [] }),
    attachPromptImageToAll: vi.fn().mockResolvedValue({ success: true, failures: [] }),
    syncPromptDraftToAll: vi.fn().mockResolvedValue({ success: true, failures: [] }),
    removeQueuedPromptItem: vi.fn().mockReturnValue({ success: true, removedCount: 1 }),
    removeQueuedPromptRound: vi.fn().mockReturnValue({ success: true, removedCount: 2 }),
    clearQueuedPrompts: vi.fn().mockReturnValue({ success: true, removedCount: 3 }),
    ...overrides,
  };
}

function getHandler(channel: string): PromptHandler {
  const handler = electronMocks.handlers.get(channel);
  if (!handler) {
    throw new Error(`Handler not registered for channel: ${channel}`);
  }
  return handler;
}

describe('registerPromptIpcHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    electronMocks.handlers.clear();
  });

  it('registers prompt and queue handlers', () => {
    registerPromptIpcHandlers(createContext(null));

    expect(electronMocks.handle).toHaveBeenCalledTimes(6);
    expect(electronMocks.handlers.has(IPC_CHANNELS.PROMPT_SEND)).toBe(true);
    expect(electronMocks.handlers.has(IPC_CHANNELS.PROMPT_ATTACH_IMAGE)).toBe(true);
    expect(electronMocks.handlers.has(IPC_CHANNELS.PROMPT_SYNC_DRAFT)).toBe(true);
    expect(electronMocks.handlers.has(IPC_CHANNELS.PROMPT_QUEUE_REMOVE_ITEM)).toBe(true);
    expect(electronMocks.handlers.has(IPC_CHANNELS.PROMPT_QUEUE_REMOVE_ROUND)).toBe(true);
    expect(electronMocks.handlers.has(IPC_CHANNELS.PROMPT_QUEUE_CLEAR)).toBe(true);
  });

  it('returns no-view-manager for queue mutation handlers when view manager is missing', async () => {
    registerPromptIpcHandlers(createContext(null));

    const removeItemHandler = getHandler(IPC_CHANNELS.PROMPT_QUEUE_REMOVE_ITEM);
    const removeRoundHandler = getHandler(IPC_CHANNELS.PROMPT_QUEUE_REMOVE_ROUND);
    const clearHandler = getHandler(IPC_CHANNELS.PROMPT_QUEUE_CLEAR);

    await expect(removeItemHandler({}, { queueItemId: 'q-1' })).resolves.toEqual({
      success: false,
      removedCount: 0,
      failures: ['no-view-manager'],
    });
    await expect(removeRoundHandler({}, { roundId: 1 })).resolves.toEqual({
      success: false,
      removedCount: 0,
      failures: ['no-view-manager'],
    });
    await expect(clearHandler({})).resolves.toEqual({
      success: false,
      removedCount: 0,
      failures: ['no-view-manager'],
    });
  });

  it('validates queue item id before remove-item dispatch', async () => {
    const viewManager = createViewManagerMock();
    registerPromptIpcHandlers(createContext(viewManager));

    const handler = getHandler(IPC_CHANNELS.PROMPT_QUEUE_REMOVE_ITEM);

    await expect(handler({}, { queueItemId: '' })).resolves.toEqual({
      success: false,
      removedCount: 0,
      failures: ['invalid-queue-item-id'],
    });
    await expect(handler({}, { queueItemId: '   ' })).resolves.toEqual({
      success: false,
      removedCount: 0,
      failures: ['invalid-queue-item-id'],
    });
    expect(viewManager.removeQueuedPromptItem).not.toHaveBeenCalled();
  });

  it('validates round id before remove-round dispatch', async () => {
    const viewManager = createViewManagerMock();
    registerPromptIpcHandlers(createContext(viewManager));

    const handler = getHandler(IPC_CHANNELS.PROMPT_QUEUE_REMOVE_ROUND);

    await expect(handler({}, { roundId: 0 })).resolves.toEqual({
      success: false,
      removedCount: 0,
      failures: ['invalid-round-id'],
    });
    await expect(handler({}, { roundId: -2 })).resolves.toEqual({
      success: false,
      removedCount: 0,
      failures: ['invalid-round-id'],
    });
    await expect(handler({}, { roundId: 2.9 })).resolves.toEqual({
      success: true,
      removedCount: 2,
    });
    expect(viewManager.removeQueuedPromptRound).toHaveBeenCalledWith(2);
  });

  it('dispatches queue mutation handlers to view manager with normalized payloads', async () => {
    const viewManager = createViewManagerMock();
    registerPromptIpcHandlers(createContext(viewManager));

    const removeItemHandler = getHandler(IPC_CHANNELS.PROMPT_QUEUE_REMOVE_ITEM);
    const clearHandler = getHandler(IPC_CHANNELS.PROMPT_QUEUE_CLEAR);

    await expect(removeItemHandler({}, { queueItemId: '  q-33  ' })).resolves.toEqual({
      success: true,
      removedCount: 1,
    });
    await expect(clearHandler({})).resolves.toEqual({
      success: true,
      removedCount: 3,
    });
    expect(viewManager.removeQueuedPromptItem).toHaveBeenCalledWith('q-33');
    expect(viewManager.clearQueuedPrompts).toHaveBeenCalledTimes(1);
  });
});
