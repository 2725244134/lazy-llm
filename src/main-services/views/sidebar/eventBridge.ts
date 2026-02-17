export interface SidebarScriptExecutionTarget {
  executeJavaScript(script: string, userGesture?: boolean): Promise<unknown>;
}

export interface ProviderLoadingTrackedWebContents {
  isLoadingMainFrame(): boolean;
  on(event: 'did-stop-loading', listener: () => void): void;
  on(event: 'did-fail-load', listener: () => void): void;
  removeListener(event: 'did-stop-loading', listener: () => void): void;
  removeListener(event: 'did-fail-load', listener: () => void): void;
}

export interface SidebarEventBridgeOptions {
  getSidebarTarget: () => SidebarScriptExecutionTarget | null;
  providerLoadingEventName: string;
  logger?: Pick<Console, 'error'>;
  createToken?: (paneIndex: number) => string;
}

export function buildDispatchEventScript(eventName: string): string {
  const serializedEventName = JSON.stringify(eventName);
  return `window.dispatchEvent(new Event(${serializedEventName}));`;
}

export function buildDispatchCustomEventScript(eventName: string, detail: unknown): string {
  const serializedEventName = JSON.stringify(eventName);
  const serializedDetail = JSON.stringify(detail);
  return `window.dispatchEvent(new CustomEvent(${serializedEventName}, { detail: ${serializedDetail} }));`;
}

export class SidebarEventBridge {
  private readonly providerSwitchLoadTokens = new Map<number, string>();
  private readonly logger: Pick<Console, 'error'>;
  private readonly createToken: (paneIndex: number) => string;

  constructor(private readonly options: SidebarEventBridgeOptions) {
    this.logger = options.logger ?? console;
    this.createToken = options.createToken ?? ((paneIndex) => `${paneIndex}:${Date.now()}:${Math.random()}`);
  }

  dispatchEvent(eventName: string): void {
    this.executeScript(
      buildDispatchEventScript(eventName),
      `[SidebarEventBridge] Failed to dispatch sidebar event ${eventName}:`
    );
  }

  dispatchCustomEvent(eventName: string, detail: unknown): void {
    this.executeScript(
      buildDispatchCustomEventScript(eventName, detail),
      `[SidebarEventBridge] Failed to dispatch sidebar event ${eventName}:`
    );
  }

  notifyProviderLoadingState(paneIndex: number, loading: boolean): void {
    this.dispatchCustomEvent(this.options.providerLoadingEventName, {
      paneIndex,
      loading,
    });
  }

  clearProviderLoadingTracking(paneIndex: number): void {
    if (!this.providerSwitchLoadTokens.has(paneIndex)) {
      return;
    }

    this.providerSwitchLoadTokens.delete(paneIndex);
    this.notifyProviderLoadingState(paneIndex, false);
  }

  beginProviderLoadingTracking(
    paneIndex: number,
    webContents: ProviderLoadingTrackedWebContents
  ): string {
    const token = this.createToken(paneIndex);
    this.providerSwitchLoadTokens.set(paneIndex, token);
    this.notifyProviderLoadingState(paneIndex, true);

    const complete = () => {
      if (webContents.isLoadingMainFrame()) {
        return;
      }
      cleanup();
      if (this.providerSwitchLoadTokens.get(paneIndex) !== token) {
        return;
      }
      this.providerSwitchLoadTokens.delete(paneIndex);
      this.notifyProviderLoadingState(paneIndex, false);
    };

    const fail = () => {
      cleanup();
      if (this.providerSwitchLoadTokens.get(paneIndex) !== token) {
        return;
      }
      this.providerSwitchLoadTokens.delete(paneIndex);
      this.notifyProviderLoadingState(paneIndex, false);
    };

    const cleanup = () => {
      webContents.removeListener('did-stop-loading', complete);
      webContents.removeListener('did-fail-load', fail);
    };

    webContents.on('did-stop-loading', complete);
    webContents.on('did-fail-load', fail);

    return token;
  }

  private executeScript(script: string, errorPrefix: string): void {
    const target = this.options.getSidebarTarget();
    if (!target) {
      return;
    }

    target.executeJavaScript(script, true).catch((error) => {
      this.logger.error(errorPrefix, error);
    });
  }
}
