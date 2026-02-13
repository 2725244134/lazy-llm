import { describe, expect, it, vi } from 'vitest';
import { PaneLoadMonitor, areUrlsEquivalent, type RecoverableWebContents } from './paneLoadMonitor';

type ListenerMap = {
  'did-finish-load': Array<() => void>;
  'did-fail-load': Array<(
    _event: unknown,
    errorCode: number,
    errorDescription: string,
    validatedURL: string,
    isMainFrame: boolean
  ) => void>;
  'render-process-gone': Array<(_event: unknown, details: { reason?: string }) => void>;
};

class MockWebContents implements RecoverableWebContents {
  readonly id: number;
  private destroyed = false;
  private currentUrl = '';
  readonly loadUrlCalls: string[] = [];
  private readonly listeners: ListenerMap = {
    'did-finish-load': [],
    'did-fail-load': [],
    'render-process-gone': [],
  };

  constructor(id: number) {
    this.id = id;
  }

  getURL(): string {
    return this.currentUrl;
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }

  loadURL(url: string): Promise<unknown> {
    this.currentUrl = url;
    this.loadUrlCalls.push(url);
    return Promise.resolve(undefined);
  }

  on(event: 'did-finish-load', listener: () => void): void;
  on(
    event: 'did-fail-load',
    listener: (
      _event: unknown,
      errorCode: number,
      errorDescription: string,
      validatedURL: string,
      isMainFrame: boolean
    ) => void
  ): void;
  on(
    event: 'render-process-gone',
    listener: (_event: unknown, details: { reason?: string }) => void
  ): void;
  on(
    event: 'did-finish-load' | 'did-fail-load' | 'render-process-gone',
    listener:
      | (() => void)
      | ((
        _event: unknown,
        errorCode: number,
        errorDescription: string,
        validatedURL: string,
        isMainFrame: boolean
      ) => void)
      | ((_event: unknown, details: { reason?: string }) => void)
  ): void {
    this.listeners[event].push(listener as never);
  }

  emitDidFinishLoad(): void {
    for (const listener of this.listeners['did-finish-load']) {
      listener();
    }
  }

  emitDidFailLoad(
    errorCode: number,
    errorDescription: string,
    validatedURL: string,
    isMainFrame: boolean
  ): void {
    for (const listener of this.listeners['did-fail-load']) {
      listener({}, errorCode, errorDescription, validatedURL, isMainFrame);
    }
  }

  emitRenderProcessGone(reason: string): void {
    for (const listener of this.listeners['render-process-gone']) {
      listener({}, { reason });
    }
  }
}

describe('areUrlsEquivalent', () => {
  it('compares URL origin, pathname, and search only', () => {
    expect(areUrlsEquivalent('https://grok.com/chat?a=1#x', 'https://grok.com/chat?a=1#y')).toBe(true);
    expect(areUrlsEquivalent('https://grok.com/chat?a=1', 'https://grok.com/chat?a=2')).toBe(false);
    expect(areUrlsEquivalent('', 'https://grok.com/chat')).toBe(false);
  });
});

describe('PaneLoadMonitor', () => {
  it('retries within max retries and then falls back to a data-url error page', async () => {
    vi.useFakeTimers();

    const webContents = new MockWebContents(1);
    const monitor = new PaneLoadMonitor({
      maxRetries: 2,
      retryBaseDelayMs: 100,
      getTargetUrlForPane: () => 'https://grok.com/',
      getProviderKeyForPane: () => 'grok',
      getProviderNameForKey: () => 'Grok',
    });

    monitor.attachPane(0, webContents);
    monitor.markTarget(webContents.id, 'https://grok.com/');

    webContents.emitDidFailLoad(-105, 'NAME_NOT_RESOLVED', 'https://grok.com/', true);
    await vi.advanceTimersByTimeAsync(100);
    expect(webContents.loadUrlCalls).toEqual(['https://grok.com/']);

    webContents.emitDidFailLoad(-105, 'NAME_NOT_RESOLVED', 'https://grok.com/', true);
    await vi.advanceTimersByTimeAsync(200);
    expect(webContents.loadUrlCalls).toEqual(['https://grok.com/', 'https://grok.com/']);

    webContents.emitDidFailLoad(-105, 'NAME_NOT_RESOLVED', 'https://grok.com/', true);
    expect(webContents.loadUrlCalls[2]).toMatch(/^data:text\/html;charset=utf-8,/);

    vi.useRealTimers();
  });

  it('resets retry attempt after a successful finish-load', async () => {
    vi.useFakeTimers();

    const webContents = new MockWebContents(2);
    const monitor = new PaneLoadMonitor({
      maxRetries: 2,
      retryBaseDelayMs: 100,
      getTargetUrlForPane: () => 'https://chatgpt.com/',
      getProviderKeyForPane: () => 'chatgpt',
      getProviderNameForKey: () => 'ChatGPT',
    });

    monitor.attachPane(0, webContents);
    monitor.markTarget(webContents.id, 'https://chatgpt.com/');

    webContents.emitDidFailLoad(-105, 'NAME_NOT_RESOLVED', 'https://chatgpt.com/', true);
    await vi.advanceTimersByTimeAsync(100);
    expect(webContents.loadUrlCalls).toHaveLength(1);

    webContents.emitDidFinishLoad();
    webContents.emitDidFailLoad(-105, 'NAME_NOT_RESOLVED', 'https://chatgpt.com/', true);
    await vi.advanceTimersByTimeAsync(100);
    expect(webContents.loadUrlCalls).toHaveLength(2);

    vi.useRealTimers();
  });

  it('ignores non-main-frame load failures', async () => {
    vi.useFakeTimers();

    const webContents = new MockWebContents(3);
    const monitor = new PaneLoadMonitor({
      maxRetries: 2,
      retryBaseDelayMs: 100,
      getTargetUrlForPane: () => 'https://claude.ai/',
      getProviderKeyForPane: () => 'claude',
      getProviderNameForKey: () => 'Claude',
    });

    monitor.attachPane(0, webContents);
    monitor.markTarget(webContents.id, 'https://claude.ai/');

    webContents.emitDidFailLoad(-105, 'NAME_NOT_RESOLVED', 'https://claude.ai/', false);
    await vi.runOnlyPendingTimersAsync();

    expect(webContents.loadUrlCalls).toHaveLength(0);

    vi.useRealTimers();
  });

  it('handles render-process-gone as a recoverable failure path', async () => {
    vi.useFakeTimers();

    const webContents = new MockWebContents(4);
    const monitor = new PaneLoadMonitor({
      maxRetries: 0,
      retryBaseDelayMs: 100,
      getTargetUrlForPane: () => 'https://perplexity.ai/',
      getProviderKeyForPane: () => 'perplexity',
      getProviderNameForKey: () => 'Perplexity',
    });

    monitor.attachPane(0, webContents);
    monitor.markTarget(webContents.id, 'https://perplexity.ai/');
    webContents.emitRenderProcessGone('crashed');

    expect(webContents.loadUrlCalls[0]).toMatch(/^data:text\/html;charset=utf-8,/);

    vi.useRealTimers();
  });
});
