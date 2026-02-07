function byTestId(testId: string): string {
  return `[data-testid="${testId}"]`;
}

export const selectors = {
  appLayout: byTestId('app-layout'),
  sidebar: byTestId('sidebar'),
  mainContent: byTestId('main-content'),
  sidebarCollapse: byTestId('sidebar-collapse'),
  promptTextarea: byTestId('prompt-textarea'),
  promptSendButton: byTestId('prompt-send-btn'),
  paneChip1: byTestId('pane-chip-1'),
  paneChip3: byTestId('pane-chip-3'),
} as const;
