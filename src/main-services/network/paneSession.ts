import { session, type Session } from 'electron';

export const PANE_SESSION_PARTITION = 'persist:lazy-llm-panes';

export interface PaneNetworkErrorRecord {
  url: string;
  error: string;
  resourceType: string;
  fromCache: boolean;
}

let diagnosticsAttached = false;

export function getPaneSession(): Session {
  return session.fromPartition(PANE_SESSION_PARTITION);
}

export function resolvePaneSessionProxy(url: string): Promise<string> {
  return getPaneSession().resolveProxy(url);
}

export function attachPaneNetworkDiagnostics(
  onError: (record: PaneNetworkErrorRecord) => void
): void {
  if (diagnosticsAttached) {
    return;
  }
  diagnosticsAttached = true;

  getPaneSession().webRequest.onErrorOccurred((details) => {
    const record: PaneNetworkErrorRecord = {
      url: typeof details.url === 'string' ? details.url : '',
      error: typeof details.error === 'string' ? details.error : 'unknown',
      resourceType: typeof details.resourceType === 'string' ? details.resourceType : 'unknown',
      fromCache: details.fromCache === true,
    };
    onError(record);
  });
}

export function resetPaneSessionDiagnosticsForTests(): void {
  diagnosticsAttached = false;
}
