import { buildPaneLoadErrorDataUrl } from './paneErrorPage.js';
import { decidePaneLoadRecovery, type PaneRecoveryState } from './paneRecovery.js';

export interface PaneLoadMonitorOptions {
  maxRetries: number;
  retryBaseDelayMs: number;
  getTargetUrlForPane: (paneIndex: number, failedUrl: string) => string;
  getProviderKeyForPane: (paneIndex: number) => string | null;
  getProviderNameForKey: (providerKey: string) => string;
  onPaneLoadFailure?: (record: PaneLoadFailureRecord) => void;
}

export interface PaneRenderProcessGoneDetails {
  reason?: string;
}

export interface RecoverableWebContents {
  readonly id: number;
  getURL(): string;
  isDestroyed(): boolean;
  loadURL(url: string): Promise<unknown>;
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
    listener: (_event: unknown, details: PaneRenderProcessGoneDetails) => void
  ): void;
}

export interface PaneLoadFailureRecord {
  paneIndex: number;
  failedUrl: string;
  targetUrl: string;
  errorCode: number;
  errorDescription: string;
  isMainFrame: boolean;
  action: 'ignore' | 'retry' | 'show-error';
  attemptCount: number;
}

const RENDERER_PROCESS_GONE_ERROR_CODE = -1000;

export function areUrlsEquivalent(left: string, right: string): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }

  try {
    const leftUrl = new URL(left);
    const rightUrl = new URL(right);
    return (
      leftUrl.origin === rightUrl.origin
      && leftUrl.pathname === rightUrl.pathname
      && leftUrl.search === rightUrl.search
    );
  } catch {
    return false;
  }
}

export class PaneLoadMonitor {
  private readonly stateByWebContents = new Map<number, PaneRecoveryState>();

  constructor(private readonly options: PaneLoadMonitorOptions) {}

  clear(webContentsId: number): void {
    this.stateByWebContents.delete(webContentsId);
  }

  clearAll(): void {
    this.stateByWebContents.clear();
  }

  markTarget(webContentsId: number, targetUrl: string): void {
    this.stateByWebContents.set(webContentsId, {
      targetUrl,
      attemptCount: 0,
    });
  }

  attachPane(paneIndex: number, webContents: RecoverableWebContents): void {
    webContents.on('did-finish-load', () => {
      const state = this.stateByWebContents.get(webContents.id);
      if (!state) {
        return;
      }

      const currentUrl = webContents.getURL();
      if (!areUrlsEquivalent(currentUrl, state.targetUrl)) {
        return;
      }

      this.stateByWebContents.set(webContents.id, {
        targetUrl: state.targetUrl,
        attemptCount: 0,
      });
    });

    webContents.on(
      'did-fail-load',
      (
        _event,
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame
      ) => {
        this.handlePaneLoadFailure({
          paneIndex,
          webContents,
          errorCode,
          errorDescription,
          failedUrl: validatedURL,
          isMainFrame,
        });
      }
    );

    webContents.on('render-process-gone', (_event, details) => {
      const recoveryState = this.stateByWebContents.get(webContents.id);
      const fallbackFailedUrl = this.options.getTargetUrlForPane(paneIndex, '');
      const failedUrl = recoveryState?.targetUrl ?? fallbackFailedUrl;
      const reason = typeof details?.reason === 'string' ? details.reason : 'unknown';

      this.handlePaneLoadFailure({
        paneIndex,
        webContents,
        errorCode: RENDERER_PROCESS_GONE_ERROR_CODE,
        errorDescription: `Renderer process gone (${reason})`,
        failedUrl,
        isMainFrame: true,
      });
    });
  }

  private handlePaneLoadFailure(options: {
    paneIndex: number;
    webContents: RecoverableWebContents;
    errorCode: number;
    errorDescription: string;
    failedUrl: string;
    isMainFrame: boolean;
  }): void {
    const {
      paneIndex,
      webContents,
      errorCode,
      errorDescription,
      failedUrl,
      isMainFrame,
    } = options;
    const previousState = this.stateByWebContents.get(webContents.id);
    const targetUrl = previousState?.targetUrl ?? this.options.getTargetUrlForPane(paneIndex, failedUrl);
    const decision = decidePaneLoadRecovery({
      isMainFrame,
      errorCode,
      failedUrl,
      targetUrl,
      maxRetries: this.options.maxRetries,
      previousState,
    });
    const attemptCount =
      decision.action === 'ignore'
        ? previousState?.attemptCount ?? 0
        : decision.state.attemptCount;
    this.options.onPaneLoadFailure?.({
      paneIndex,
      failedUrl,
      targetUrl,
      errorCode,
      errorDescription,
      isMainFrame,
      action: decision.action,
      attemptCount,
    });

    if (decision.action === 'ignore') {
      return;
    }

    this.stateByWebContents.set(webContents.id, decision.state);

    if (decision.action === 'retry') {
      const expectedAttempt = decision.state.attemptCount;
      const expectedTargetUrl = decision.state.targetUrl;
      const delayMs = this.options.retryBaseDelayMs * expectedAttempt;

      setTimeout(() => {
        if (webContents.isDestroyed()) {
          return;
        }

        const latestState = this.stateByWebContents.get(webContents.id);
        if (!latestState) {
          return;
        }
        if (
          latestState.targetUrl !== expectedTargetUrl
          || latestState.attemptCount !== expectedAttempt
        ) {
          return;
        }

        webContents.loadURL(expectedTargetUrl).catch((error) => {
          console.error('[PaneLoadMonitor] Retry load failed:', error);
        });
      }, delayMs);
      return;
    }

    if (webContents.isDestroyed()) {
      return;
    }

    const providerKey = this.options.getProviderKeyForPane(paneIndex);
    const providerName = providerKey
      ? this.options.getProviderNameForKey(providerKey)
      : 'Unknown provider';
    const fallbackUrl = buildPaneLoadErrorDataUrl({
      providerName,
      targetUrl: decision.state.targetUrl,
      errorCode,
      errorDescription,
      attemptCount: decision.state.attemptCount,
    });

    webContents.loadURL(fallbackUrl).catch((error) => {
      console.error('[PaneLoadMonitor] Failed to render load error fallback:', error);
    });
  }
}
