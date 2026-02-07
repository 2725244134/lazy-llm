import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElectronRuntime } from './electronRuntime';

function stubWindowCouncil(overrides: Partial<Window['council']> = {}) {
  const council: Window['council'] = {
    healthCheck: vi.fn(),
    getConfig: vi.fn().mockResolvedValue({
      sidebar: { expanded_width: 280, collapsed_width: 48 },
      defaults: { pane_count: 2, providers: ['chatgpt', 'claude'] },
      providers: [],
    }),
    setPaneCount: vi.fn().mockResolvedValue({ success: true }),
    updateProvider: vi.fn().mockResolvedValue({ success: true, paneIndex: 0 }),
    sendPrompt: vi.fn().mockResolvedValue({ success: true }),
    updateLayout: vi.fn().mockResolvedValue({ success: true }),
    getLayoutSnapshot: vi.fn(),
    updateSidebarWidth: vi.fn().mockResolvedValue({ success: true }),
    ...overrides,
  };

  vi.stubGlobal('window', { council });
  return council;
}

describe('createElectronRuntime', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws when Electron bridge is missing', () => {
    vi.stubGlobal('window', {});

    expect(() => createElectronRuntime()).toThrow('Electron bridge (window.council) is not available');
  });

  it('forwards layout updates with sidebar width and pane count', async () => {
    const updateLayout = vi.fn().mockResolvedValue({ success: true });
    stubWindowCouncil({ updateLayout });
    const runtime = createElectronRuntime();

    await runtime.updateLayout({
      viewportWidth: 1400,
      viewportHeight: 900,
      paneCount: 3,
      sidebarWidth: 320,
    });

    expect(updateLayout).toHaveBeenCalledWith({
      sidebarWidth: 320,
      paneCount: 3,
    });
  });

  it('throws when setPaneCount returns unsuccessful result', async () => {
    stubWindowCouncil({
      setPaneCount: vi.fn().mockResolvedValue({ success: false }),
    });
    const runtime = createElectronRuntime();

    await expect(runtime.setPaneCount(2)).rejects.toThrow('Failed to set pane count');
  });

  it('throws with failure details when sendPrompt fails', async () => {
    stubWindowCouncil({
      sendPrompt: vi.fn().mockResolvedValue({ success: false, failures: ['pane-1', 'pane-2'] }),
    });
    const runtime = createElectronRuntime();

    await expect(runtime.sendPrompt('hello')).rejects.toThrow('Failed to send prompt: pane-1, pane-2');
  });
});
