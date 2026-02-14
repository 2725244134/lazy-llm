import { beforeEach, describe, expect, it, vi } from 'vitest';

const electronMocks = vi.hoisted(() => {
  const resolveProxy = vi.fn();
  const onErrorOccurred = vi.fn();
  const fromPartition = vi.fn(() => ({
    resolveProxy,
    webRequest: {
      onErrorOccurred,
    },
  }));
  return {
    resolveProxy,
    onErrorOccurred,
    fromPartition,
  };
});

vi.mock('electron', () => ({
  session: {
    fromPartition: electronMocks.fromPartition,
  },
}));

import {
  attachPaneNetworkDiagnostics,
  getPaneSession,
  PANE_SESSION_PARTITION,
  resetPaneSessionDiagnosticsForTests,
  resolvePaneSessionProxy,
} from './paneSession';

describe('paneSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPaneSessionDiagnosticsForTests();
  });

  it('retrieves pane session from dedicated partition', () => {
    getPaneSession();
    expect(electronMocks.fromPartition).toHaveBeenCalledWith(PANE_SESSION_PARTITION);
  });

  it('delegates proxy resolution to pane session', async () => {
    electronMocks.resolveProxy.mockResolvedValueOnce('DIRECT');
    await expect(resolvePaneSessionProxy('https://chatgpt.com')).resolves.toBe('DIRECT');
    expect(electronMocks.resolveProxy).toHaveBeenCalledWith('https://chatgpt.com');
  });

  it('attaches diagnostics once and forwards normalized error records', () => {
    const listeners: Array<(details: unknown) => void> = [];
    electronMocks.onErrorOccurred.mockImplementation((listener: (details: unknown) => void) => {
      listeners.push(listener);
    });
    const records: Array<Record<string, unknown>> = [];

    attachPaneNetworkDiagnostics((record) => {
      records.push(record as unknown as Record<string, unknown>);
    });
    attachPaneNetworkDiagnostics((record) => {
      records.push(record as unknown as Record<string, unknown>);
    });

    expect(electronMocks.onErrorOccurred).toHaveBeenCalledTimes(1);
    expect(listeners).toHaveLength(1);

    listeners[0]({
      url: 'https://chatgpt.com/',
      error: 'net::ERR_FAILED',
      resourceType: 'mainFrame',
      fromCache: false,
    });

    expect(records).toEqual([
      {
        url: 'https://chatgpt.com/',
        error: 'net::ERR_FAILED',
        resourceType: 'mainFrame',
        fromCache: false,
      },
    ]);
  });
});
