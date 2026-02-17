import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderMeta } from '@shared-contracts/ipc/contracts';
import { ViewManager } from './manager';
import { resetAllPanesToProviderHomeWithLifecycle } from './paneLifecycleService';

vi.mock('./paneLifecycleService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./paneLifecycleService.js')>();
  return {
    ...actual,
    resetAllPanesToProviderHomeWithLifecycle: vi.fn(),
  };
});

const mockedResetAllPanesToProviderHomeWithLifecycle = vi.mocked(
  resetAllPanesToProviderHomeWithLifecycle
);

interface ResetHarness {
  manager: ViewManager;
  clearQueuedPrompts: ReturnType<typeof vi.fn>;
  keepQuickPromptOnTop: ReturnType<typeof vi.fn>;
  syncActiveTabSessionState: ReturnType<typeof vi.fn>;
  buildLifecycleCallbacks: ReturnType<typeof vi.fn>;
  paneViews: unknown[];
  defaultProviders: string[];
  providers: Map<string, ProviderMeta>;
}

function createResetHarness(): ResetHarness {
  const clearQueuedPrompts = vi.fn();
  const keepQuickPromptOnTop = vi.fn();
  const syncActiveTabSessionState = vi.fn();
  const lifecycleCallbacks = { marker: true };
  const buildLifecycleCallbacks = vi.fn(() => lifecycleCallbacks);
  const paneViews: unknown[] = [];
  const defaultProviders = ['chatgpt'];
  const providers = new Map<string, ProviderMeta>();

  const manager = {
    promptDispatchService: {
      clearQueuedPrompts,
    },
    paneViews,
    defaultProviders,
    providers,
    buildLifecycleCallbacks,
    keepQuickPromptOnTop,
    syncActiveTabSessionState,
  } as unknown as ViewManager;

  return {
    manager,
    clearQueuedPrompts,
    keepQuickPromptOnTop,
    syncActiveTabSessionState,
    buildLifecycleCallbacks,
    paneViews,
    defaultProviders,
    providers,
  };
}

describe('ViewManager.resetAllPanesToProviderHome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears queued prompts before resetting panes', () => {
    mockedResetAllPanesToProviderHomeWithLifecycle.mockReturnValue(true);
    const harness = createResetHarness();

    const success = ViewManager.prototype.resetAllPanesToProviderHome.call(harness.manager);

    expect(success).toBe(true);
    expect(harness.clearQueuedPrompts).toHaveBeenCalledTimes(1);
    expect(mockedResetAllPanesToProviderHomeWithLifecycle).toHaveBeenCalledWith({
      paneViews: harness.paneViews,
      defaultProviders: harness.defaultProviders,
      providers: harness.providers,
      callbacks: { marker: true },
    });
    expect(harness.syncActiveTabSessionState).toHaveBeenCalledTimes(1);
    expect(harness.keepQuickPromptOnTop).toHaveBeenCalledTimes(1);
    expect(harness.clearQueuedPrompts.mock.invocationCallOrder[0]).toBeLessThan(
      mockedResetAllPanesToProviderHomeWithLifecycle.mock.invocationCallOrder[0]
    );
  });

  it('still returns reset result after queue is cleared', () => {
    mockedResetAllPanesToProviderHomeWithLifecycle.mockReturnValue(false);
    const harness = createResetHarness();

    const success = ViewManager.prototype.resetAllPanesToProviderHome.call(harness.manager);

    expect(success).toBe(false);
    expect(harness.clearQueuedPrompts).toHaveBeenCalledTimes(1);
    expect(harness.syncActiveTabSessionState).toHaveBeenCalledTimes(1);
    expect(harness.keepQuickPromptOnTop).toHaveBeenCalledTimes(1);
  });
});
