import { describe, expect, it, vi } from 'vitest';
import {
  buildDispatchCustomEventScript,
  buildDispatchEventScript,
  SidebarEventBridge,
  type ProviderLoadingTrackedWebContents,
  type SidebarScriptExecutionTarget,
} from './sidebarEventBridge';

type LoadingEventName = 'did-stop-loading' | 'did-fail-load';

type LoadingListeners = {
  'did-stop-loading': Array<() => void>;
  'did-fail-load': Array<() => void>;
};

class MockLoadingWebContents implements ProviderLoadingTrackedWebContents {
  private isMainFrameLoadingState = false;
  private readonly listeners: LoadingListeners = {
    'did-stop-loading': [],
    'did-fail-load': [],
  };

  isLoadingMainFrame(): boolean {
    return this.isMainFrameLoadingState;
  }

  setMainFrameLoading(next: boolean): void {
    this.isMainFrameLoadingState = next;
  }

  on(event: LoadingEventName, listener: () => void): void {
    this.listeners[event].push(listener);
  }

  removeListener(event: LoadingEventName, listener: () => void): void {
    this.listeners[event] = this.listeners[event].filter(existing => existing !== listener);
  }

  emit(event: LoadingEventName): void {
    for (const listener of [...this.listeners[event]]) {
      listener();
    }
  }
}

function getLoadingNotificationScripts(
  executeJavaScriptMock: ReturnType<typeof vi.fn>,
  providerLoadingEventName: string,
  paneIndex: number,
  loading: boolean
): Array<string> {
  const expectedScript = buildDispatchCustomEventScript(providerLoadingEventName, {
    paneIndex,
    loading,
  });
  const calls = executeJavaScriptMock.mock.calls as Array<[string, boolean?]>;

  return calls
    .map(([script]) => script)
    .filter((script): script is string => script === expectedScript);
}

describe('sidebar event script builders', () => {
  it('builds deterministic event scripts', () => {
    expect(buildDispatchEventScript('sidebar:toggle')).toBe(
      'window.dispatchEvent(new Event("sidebar:toggle"));'
    );

    expect(buildDispatchCustomEventScript('provider:loading', { paneIndex: 1, loading: true })).toBe(
      'window.dispatchEvent(new CustomEvent("provider:loading", { detail: {"paneIndex":1,"loading":true} }));'
    );
  });
});

describe('SidebarEventBridge', () => {
  it('dispatches plain and custom events through executeJavaScript', () => {
    const executeJavaScript = vi.fn().mockResolvedValue(undefined);
    const sidebarTarget: SidebarScriptExecutionTarget = {
      executeJavaScript,
    };
    const bridge = new SidebarEventBridge({
      getSidebarTarget: () => sidebarTarget,
      providerLoadingEventName: 'provider:loading',
    });

    bridge.dispatchEvent('sidebar:toggle');
    bridge.dispatchCustomEvent('sidebar:payload', { enabled: true });

    expect(executeJavaScript).toHaveBeenNthCalledWith(
      1,
      buildDispatchEventScript('sidebar:toggle'),
      true
    );
    expect(executeJavaScript).toHaveBeenNthCalledWith(
      2,
      buildDispatchCustomEventScript('sidebar:payload', { enabled: true }),
      true
    );
  });

  it('notifies provider loading state and clears only active tracking token', () => {
    const executeJavaScript = vi.fn().mockResolvedValue(undefined);
    const sidebarTarget: SidebarScriptExecutionTarget = {
      executeJavaScript,
    };
    const bridge = new SidebarEventBridge({
      getSidebarTarget: () => sidebarTarget,
      providerLoadingEventName: 'provider:loading',
      createToken: (() => {
        let id = 0;
        return () => `token-${++id}`;
      })(),
    });

    const firstWebContents = new MockLoadingWebContents();
    const secondWebContents = new MockLoadingWebContents();

    bridge.beginProviderLoadingTracking(0, firstWebContents);
    bridge.beginProviderLoadingTracking(0, secondWebContents);

    firstWebContents.emit('did-stop-loading');
    expect(getLoadingNotificationScripts(executeJavaScript, 'provider:loading', 0, false)).toHaveLength(
      0
    );

    secondWebContents.setMainFrameLoading(true);
    secondWebContents.emit('did-stop-loading');
    expect(getLoadingNotificationScripts(executeJavaScript, 'provider:loading', 0, false)).toHaveLength(
      0
    );

    secondWebContents.setMainFrameLoading(false);
    secondWebContents.emit('did-stop-loading');
    expect(getLoadingNotificationScripts(executeJavaScript, 'provider:loading', 0, false)).toHaveLength(
      1
    );
  });

  it('supports clear semantics without duplicate false notifications', () => {
    const executeJavaScript = vi.fn().mockResolvedValue(undefined);
    const sidebarTarget: SidebarScriptExecutionTarget = {
      executeJavaScript,
    };
    const bridge = new SidebarEventBridge({
      getSidebarTarget: () => sidebarTarget,
      providerLoadingEventName: 'provider:loading',
      createToken: () => 'token-clear',
    });

    const trackedWebContents = new MockLoadingWebContents();
    bridge.beginProviderLoadingTracking(2, trackedWebContents);

    bridge.clearProviderLoadingTracking(2);
    bridge.clearProviderLoadingTracking(2);
    trackedWebContents.emit('did-fail-load');

    expect(getLoadingNotificationScripts(executeJavaScript, 'provider:loading', 2, true)).toHaveLength(
      1
    );
    expect(getLoadingNotificationScripts(executeJavaScript, 'provider:loading', 2, false)).toHaveLength(
      1
    );
  });

  it('is a no-op when sidebar target is unavailable', () => {
    const bridge = new SidebarEventBridge({
      getSidebarTarget: () => null,
      providerLoadingEventName: 'provider:loading',
    });

    expect(() => {
      bridge.dispatchEvent('sidebar:toggle');
      bridge.dispatchCustomEvent('sidebar:payload', { enabled: true });
      bridge.notifyProviderLoadingState(0, true);
    }).not.toThrow();
  });
});
