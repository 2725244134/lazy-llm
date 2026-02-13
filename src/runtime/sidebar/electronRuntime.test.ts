import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElectronRuntime } from './electronRuntime';

function stubWindowLazyllm(overrides: Partial<Window['lazyllm']> = {}) {
  const lazyllm: Window['lazyllm'] = {
    healthCheck: vi.fn(),
    getConfig: vi.fn().mockResolvedValue({
      provider: { pane_count: 2, panes: ['chatgpt', 'claude'], catalog: [] },
      sidebar: { expanded_width: 280, collapsed_width: 48 },
      quick_prompt: { default_height: 74 },
    }),
    setPaneCount: vi.fn().mockResolvedValue({ success: true }),
    resetAllPanes: vi.fn().mockResolvedValue({ success: true }),
    updateProvider: vi.fn().mockResolvedValue({ success: true, paneIndex: 0 }),
    sendPrompt: vi.fn().mockResolvedValue({ success: true }),
    syncPromptDraft: vi.fn().mockResolvedValue({ success: true }),
    updateLayout: vi.fn().mockResolvedValue({ success: true }),
    updateSidebarWidth: vi.fn().mockResolvedValue({ success: true }),
    toggleQuickPrompt: vi.fn().mockResolvedValue({ success: true, visible: true }),
    hideQuickPrompt: vi.fn().mockResolvedValue({ success: true, visible: false }),
    resizeQuickPrompt: vi.fn().mockResolvedValue({ success: true, visible: true, height: 180 }),
    ...overrides,
  };

  vi.stubGlobal('window', { lazyllm });
  return lazyllm;
}

describe('createElectronRuntime', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws when Electron bridge is missing', () => {
    vi.stubGlobal('window', {});

    expect(() => createElectronRuntime()).toThrow('Electron bridge (window.lazyllm) is not available');
  });

  it('forwards layout updates with sidebar width and pane count', async () => {
    const updateLayout = vi.fn().mockResolvedValue({ success: true });
    stubWindowLazyllm({ updateLayout });
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
    stubWindowLazyllm({
      setPaneCount: vi.fn().mockResolvedValue({ success: false }),
    });
    const runtime = createElectronRuntime();

    await expect(runtime.setPaneCount(2)).rejects.toThrow('Failed to set pane count');
  });

  it('forwards reset-all requests to Electron bridge', async () => {
    const resetAllPanes = vi.fn().mockResolvedValue({ success: true });
    stubWindowLazyllm({ resetAllPanes });
    const runtime = createElectronRuntime();

    await runtime.resetAllPanes();

    expect(resetAllPanes).toHaveBeenCalled();
  });

  it('throws when resetAllPanes returns unsuccessful result', async () => {
    stubWindowLazyllm({
      resetAllPanes: vi.fn().mockResolvedValue({ success: false }),
    });
    const runtime = createElectronRuntime();

    await expect(runtime.resetAllPanes()).rejects.toThrow('Failed to reset all panes');
  });

  it('throws with failure details when sendPrompt fails', async () => {
    stubWindowLazyllm({
      sendPrompt: vi.fn().mockResolvedValue({ success: false, failures: ['pane-1', 'pane-2'] }),
    });
    const runtime = createElectronRuntime();

    await expect(runtime.sendPrompt('hello')).rejects.toThrow('Failed to send prompt: pane-1, pane-2');
  });

  it('forwards prompt draft sync requests', async () => {
    const syncPromptDraft = vi.fn().mockResolvedValue({ success: true });
    stubWindowLazyllm({ syncPromptDraft });
    const runtime = createElectronRuntime();

    await runtime.syncPromptDraft('draft value');

    expect(syncPromptDraft).toHaveBeenCalledWith({ text: 'draft value' });
  });
});
